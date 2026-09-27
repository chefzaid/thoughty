import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ObjectLiteral, Repository } from 'typeorm';
import { CommentLike, Entry, EntryComment, EntryLike } from '@/database/entities';
import type { LikeStateDto } from './dto';
import { findFeedVisibleEntry } from './public-feed-visibility';

export type LikeSummary = LikeStateDto;

const NO_LIKES: LikeSummary = { liked: false, likeCount: 0 };

interface LikeSummaryRow {
  targetId: number | string;
  likeCount: number | string;
  liked: boolean;
}

@Injectable()
export class LikesService {
  constructor(
    @InjectRepository(EntryLike)
    private readonly entryLikeRepository: Repository<EntryLike>,
    @InjectRepository(CommentLike)
    private readonly commentLikeRepository: Repository<CommentLike>,
    @InjectRepository(EntryComment)
    private readonly commentRepository: Repository<EntryComment>,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  async setEntryLike(userId: number, entryId: number, like: boolean): Promise<LikeStateDto> {
    const entry = await findFeedVisibleEntry(this.entryRepository, entryId);
    if (like && entry.userId === userId) {
      throw new BadRequestException('You cannot like your own entry');
    }

    if (like) {
      await this.entryLikeRepository
        .createQueryBuilder()
        .insert()
        .into(EntryLike)
        .values({ entryId, userId })
        .orIgnore()
        .execute();
    } else {
      await this.entryLikeRepository.delete({ entryId, userId });
    }
    return (await this.summarizeEntryLikes(userId, [entryId])).get(entryId) ?? NO_LIKES;
  }

  async setCommentLike(
    userId: number,
    entryId: number,
    commentId: number,
    like: boolean,
  ): Promise<LikeStateDto> {
    await findFeedVisibleEntry(this.entryRepository, entryId);
    const comment = await this.commentRepository
      .createQueryBuilder('c')
      .innerJoin('c.user', 'u')
      .select(['c.id', 'c.userId'])
      .where('c.id = :commentId', { commentId })
      .andWhere('c.entry_id = :entryId', { entryId })
      .andWhere('u.deleted_at IS NULL')
      .getOne();
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (like && comment.userId === userId) {
      throw new BadRequestException('You cannot like your own comment');
    }

    if (like) {
      await this.commentLikeRepository
        .createQueryBuilder()
        .insert()
        .into(CommentLike)
        .values({ commentId, userId })
        .orIgnore()
        .execute();
    } else {
      await this.commentLikeRepository.delete({ commentId, userId });
    }
    return (await this.summarizeCommentLikes(userId, [commentId])).get(commentId) ?? NO_LIKES;
  }

  summarizeEntryLikes(userId: number, entryIds: number[]): Promise<Map<number, LikeSummary>> {
    return this.summarize(this.entryLikeRepository, 'entry_id', userId, entryIds);
  }

  summarizeCommentLikes(userId: number, commentIds: number[]): Promise<Map<number, LikeSummary>> {
    return this.summarize(this.commentLikeRepository, 'comment_id', userId, commentIds);
  }

  /** Counts likes by active users per target and whether `userId` is among them. */
  private async summarize<T extends ObjectLiteral>(
    repository: Repository<T>,
    targetColumn: 'entry_id' | 'comment_id',
    userId: number,
    targetIds: number[],
  ): Promise<Map<number, LikeSummary>> {
    if (targetIds.length === 0) return new Map();

    const rows = await repository
      .createQueryBuilder('l')
      .innerJoin('l.user', 'u')
      .select(`l.${targetColumn}`, 'targetId')
      .addSelect('COUNT(*)', 'likeCount')
      .addSelect('BOOL_OR(l.user_id = :userId)', 'liked')
      .where(`l.${targetColumn} IN (:...targetIds)`, { targetIds })
      .andWhere('u.deleted_at IS NULL')
      .setParameter('userId', userId)
      .groupBy(`l.${targetColumn}`)
      .getRawMany<LikeSummaryRow>();
    return new Map(
      rows.map((row) => [
        Number(row.targetId),
        { likeCount: Number(row.likeCount), liked: row.liked === true },
      ]),
    );
  }
}
