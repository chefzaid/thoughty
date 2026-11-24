import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Entry, EntryComment, type FollowStatus, UserFollow } from '@/database/entities';
import { inlineImagesToAltText } from '@/common/utils';
import type { GetPublicFeedQueryDto, PublicFeedEntryDto, PublicFeedResponseDto } from './dto';
import { LikesService } from './likes.service';
import { applyEntrySearchMatch, EntrySearchService } from '@/modules/entries';
import { applyFeedScope, applyFeedTopic } from './public-feed-filters';
import { applyPublicFeedVisibility, excludeHiddenWriters, excludeUnreadable } from './public-feed-visibility';
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
        'u.followersByApproval',
      ]);
    applyPublicFeedVisibility(qb);
    // Muting keeps a writer out of the stream tabs; the reader's own Saved list keeps what they chose, and
    // one entry asked for by its id (from a notification) is shown wherever it would be
    const oneEntry = query.entry !== undefined;
    excludeHiddenWriters(qb, 'e.user_id', userId, {
      muted: !oneEntry && (scope === 'community' || scope === 'following'),
    });
    if (oneEntry) {
      qb.andWhere('e.id = :entryId', { entryId: query.entry }).orderBy('e.createdAt', 'DESC');
    } else {
      applyFeedScope(qb, scope, userId);
    }
    if (query.tag !== undefined) {
      applyFeedTopic(qb, query.tag);
    }
    const prepared = query.search ? await this.entrySearchService.prepare(query.search) : null;
    if (prepared) {
      applyEntrySearchMatch(qb, prepared);
    }
    // A teaser shows no text or tags, so a topic or a search never lists one: it would tell what they hold
    if (query.tag !== undefined || prepared) {
      excludeUnreadable(qb, 'e.user_id', userId);
    }

    const total = await qb.getCount();
    // Each row is one entry (its author and the reader's save are one each), so a plain LIMIT pages it
    qb.addOrderBy('e.id', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);
    const entries = await qb.getMany();
    const totalPages = Math.ceil(total / limit);
    const entryIds = entries.map((entry) => entry.id);
    const [followStates, commentCounts, likes, savedIds] = await Promise.all([
      this.findFollowStates(
        userId,
        entries.map((entry) => entry.user.id),
      ),
      this.countComments(userId, entryIds),
      this.likesService.summarizeEntryLikes(userId, entryIds),
      scope === 'saved' && !oneEntry
        ? Promise.resolve(new Set(entryIds))
        : this.savedEntriesService.findSavedIds(userId, entryIds),
    ]);

    return {
      entries: entries.map((entry): PublicFeedEntryDto => {
        const followStatus = followStates.get(entry.user.id);
        const author = {
          id: entry.user.id,
          username: entry.user.username,
          avatarUrl: entry.user.avatarUrl,
          isFollowed: followStatus === 'approved',
          followRequested: followStatus === 'pending',
          approvalRequired: entry.user.followersByApproval,
        };
        const saved = savedIds.has(entry.id);
        if (isTeaser(entry.user, userId, followStatus)) {
          return toTeaser(entry, author, saved);
        }
        return {
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
          saved,
          locked: false,
          author,
        };
      }),
      total,
      page,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  /** The reader's follow of each author, approved or still a request, if any. */
  private async findFollowStates(userId: number, authorIds: number[]): Promise<Map<number, FollowStatus>> {
    const candidates = [...new Set(authorIds)].filter((authorId) => authorId !== userId);
    if (candidates.length === 0) return new Map();

    const follows = await this.followRepository.find({
      where: { followerId: userId, followedId: In(candidates) },
      select: { followedId: true, status: true },
    });
    return new Map(follows.map((follow) => [follow.followedId, follow.status]));
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

/** The reader sees only a teaser of another writer's entry when that writer approves followers and has not approved them. */
function isTeaser(
  author: Pick<Entry['user'], 'id' | 'followersByApproval'>,
  readerId: number,
  followStatus: FollowStatus | undefined,
): boolean {
  return author.followersByApproval && author.id !== readerId && followStatus !== 'approved';
}

/**
 * What a teaser carries: who wrote it, its day and its title, and nothing of its text, tags, time of day,
 * likes or comments, so a writer who is not an approved follower can ask to follow without reading it.
 */
function toTeaser(
  entry: Entry,
  author: PublicFeedEntryDto['author'],
  saved: boolean,
): PublicFeedEntryDto {
  return {
    id: entry.id,
    date: entry.date,
    index: entry.index,
    title: entry.title ?? null,
    timeOfDay: null,
    tags: [],
    content: '',
    format: 'plain',
    createdAt: entry.createdAt,
    commentCount: 0,
    likeCount: 0,
    liked: false,
    saved,
    locked: true,
    author,
  };
}
