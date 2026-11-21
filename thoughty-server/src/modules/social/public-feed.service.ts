import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Entry, EntryComment, UserFollow } from '@/database/entities';
import { inlineImagesToAltText } from '@/common/utils';
import type { GetPublicFeedQueryDto, PublicFeedResponseDto } from './dto';
import { LikesService } from './likes.service';
import { applyEntrySearchMatch, EntrySearchService } from '@/modules/entries';
import { applyFeedScope, applyFeedTopic } from './public-feed-filters';
import { applyPublicFeedVisibility, excludeHiddenWriters } from './public-feed-visibility';
import { SavedEntriesService } from './saved-entries.service';

@Injectable()
export class PublicFeedService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(UserFollow)
    private readonly followRepository: Repository<UserFollow>,
    @InjectRepository(EntryComment)
    private readonly commentRepository: Repository<EntryComment>,
    private readonly likesService: LikesService,
    private readonly savedEntriesService: SavedEntriesService,
    private readonly entrySearchService: EntrySearchService,
  ) {}

  async getFeed(userId: number, query: GetPublicFeedQueryDto): Promise<PublicFeedResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const scope = query.scope ?? 'community';
    const qb = this.entryRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'u')
      .select([
        'e.id',
        'e.date',
        'e.index',
        'e.title',
        'e.timeOfDay',
        'e.tags',
        'e.content',
        'e.format',
        'e.createdAt',
        'u.id',
        'u.username',
        'u.avatarUrl',
      ]);
    applyPublicFeedVisibility(qb);
    // Muting keeps a writer out of the stream tabs; the reader's own Saved list keeps what they chose
    excludeHiddenWriters(qb, 'e.user_id', userId, {
      muted: scope === 'community' || scope === 'following',
    });
    applyFeedScope(qb, scope, userId);
    if (query.tag !== undefined) {
      applyFeedTopic(qb, query.tag);
    }
    const prepared = query.search ? await this.entrySearchService.prepare(query.search) : null;
    if (prepared) {
      applyEntrySearchMatch(qb, prepared);
    }

    const total = await qb.getCount();
    // Each row is one entry (its author and the reader's save are one each), so a plain LIMIT pages it
    qb.addOrderBy('e.id', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);
    const entries = await qb.getMany();
    const totalPages = Math.ceil(total / limit);
    const entryIds = entries.map((entry) => entry.id);
    const [followedIds, commentCounts, likes, savedIds] = await Promise.all([
      this.findFollowedAuthorIds(
        userId,
        entries.map((entry) => entry.user.id),
      ),
      this.countComments(userId, entryIds),
      this.likesService.summarizeEntryLikes(userId, entryIds),
      scope === 'saved'
        ? Promise.resolve(new Set(entryIds))
        : this.savedEntriesService.findSavedIds(userId, entryIds),
    ]);

    return {
      entries: entries.map((entry) => ({
        id: entry.id,
        date: entry.date,
        index: entry.index,
        title: entry.title ?? null,
        timeOfDay: entry.timeOfDay ?? null,
        tags: entry.tags,
        // Attachments are private: an inline image reaches the feed as its alt text
        content: entry.format === 'markdown' ? inlineImagesToAltText(entry.content) : entry.content,
        format: entry.format,
        createdAt: entry.createdAt,
        commentCount: commentCounts.get(entry.id) ?? 0,
        likeCount: likes.get(entry.id)?.likeCount ?? 0,
        liked: likes.get(entry.id)?.liked ?? false,
        saved: savedIds.has(entry.id),
        author: {
          id: entry.user.id,
          username: entry.user.username,
          avatarUrl: entry.user.avatarUrl,
          isFollowed: followedIds.has(entry.user.id),
        },
      })),
      total,
      page,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  private async findFollowedAuthorIds(userId: number, authorIds: number[]): Promise<Set<number>> {
    const candidates = [...new Set(authorIds)].filter((authorId) => authorId !== userId);
    if (candidates.length === 0) return new Set();

    const follows = await this.followRepository.find({
      where: { followerId: userId, followedId: In(candidates) },
      select: { followedId: true },
    });
    return new Set(follows.map((follow) => follow.followedId));
  }

  /**
   * Comments the reader may see: hidden ones count only for the entry's writer and their own writer, and
   * none by a writer the reader muted or has a block with.
   */
  private async countComments(userId: number, entryIds: number[]): Promise<Map<number, number>> {
    if (entryIds.length === 0) return new Map();

    const qb = this.commentRepository
      .createQueryBuilder('c')
      .innerJoin('c.user', 'u')
      .innerJoin('c.entry', 'ce')
      .select('c.entry_id', 'entryId')
      .addSelect('COUNT(c.id)', 'count')
      .where('c.entry_id IN (:...entryIds)', { entryIds })
      .andWhere('u.deleted_at IS NULL')
      .andWhere('(c.hidden_at IS NULL OR c.user_id = :userId OR ce.user_id = :userId)', { userId })
      .groupBy('c.entry_id');
    const rows = await excludeHiddenWriters(qb, 'c.user_id', userId, {
      muted: true,
    }).getRawMany<{ entryId: number | string; count: number | string }>();
    return new Map(rows.map((row) => [Number(row.entryId), Number(row.count)]));
  }
}
