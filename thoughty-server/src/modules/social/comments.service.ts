import { Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry, EntryComment } from '@/database/entities';
import { CommentPolicyService } from './comment-policy.service';
import { LikesService, type LikeSummary } from './likes.service';
import { findFeedVisibleEntry } from './public-feed-visibility';
import type { EntryCommentDeletedDto, EntryCommentDto, EntryCommentsResponseDto } from './dto';

/** Newest comments returned per entry; older ones are counted in `total`. */
export const MAX_LISTED_COMMENTS = 100;

export function toCommentDto(
  comment: EntryComment,
  currentUserId: number,
  entryOwnerId: number,
  likes: LikeSummary = { likeCount: 0, liked: false },
): EntryCommentDto {
  return {
    id: comment.id,
    content: comment.content,
    createdAt: new Date(comment.createdAt).toISOString(),
    author: {
      id: comment.user.id,
      username: comment.user.username,
      avatarUrl: comment.user.avatarUrl,
    },
    canDelete: comment.userId === currentUserId || entryOwnerId === currentUserId,
    likeCount: likes.likeCount,
    liked: likes.liked,
    hidden: comment.hiddenAt != null,
    pinned: comment.pinnedAt != null,
  };
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(EntryComment)
    private readonly commentRepository: Repository<EntryComment>,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    private readonly likesService: LikesService,
    private readonly commentPolicyService: CommentPolicyService,
  ) {}

  /**
   * The pinned comment first, then the newest others, oldest first. A hidden comment is listed only
   * to the entry's writer and its own writer.
   */
  async list(userId: number, entryId: number): Promise<EntryCommentsResponseDto> {
    const entry = await findFeedVisibleEntry(this.entryRepository, entryId);
    const qb = this.commentRepository
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.user', 'u')
      .select([
        'c.id',
        'c.userId',
        'c.content',
        'c.createdAt',
        'c.hiddenAt',
        'c.pinnedAt',
        'u.id',
        'u.username',
        'u.avatarUrl',
      ])
      .where('c.entry_id = :entryId', { entryId })
      .andWhere('u.deleted_at IS NULL');
    if (entry.userId !== userId) {
      qb.andWhere('(c.hidden_at IS NULL OR c.user_id = :userId)', { userId });
    }
    const [comments, total] = await qb
      .orderBy('c.pinnedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('c.createdAt', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .take(MAX_LISTED_COMMENTS)
      .getManyAndCount();

    const [likes, policy] = await Promise.all([
      this.likesService.summarizeCommentLikes(
        userId,
        comments.map((comment) => comment.id),
      ),
      this.commentPolicyService.stateFor(userId, entry),
    ]);
    const pinned = comments.filter((comment) => comment.pinnedAt != null);
    const others = comments.filter((comment) => comment.pinnedAt == null).reverse();
    return {
      comments: [...pinned, ...others].map((comment) =>
        toCommentDto(comment, userId, entry.userId, likes.get(comment.id)),
      ),
      total,
      ...policy,
      canModerate: entry.userId === userId,
    };
  }

  async create(userId: number, entryId: number, content: string): Promise<EntryCommentDto> {
    const entry = await findFeedVisibleEntry(this.entryRepository, entryId);
    await this.commentPolicyService.assertMayComment(userId, entry);
    const saved = await this.commentRepository.save(
      this.commentRepository.create({ entryId, userId, content }),
    );
    const comment = await this.commentRepository.findOneOrFail({
      where: { id: saved.id },
      relations: { user: true },
    });
    return toCommentDto(comment, userId, entry.userId);
  }

  async remove(
    userId: number,
    entryId: number,
    commentId: number,
  ): Promise<EntryCommentDeletedDto> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, entryId },
      relations: { entry: true },
    });
    if (!comment || (comment.userId !== userId && comment.entry.userId !== userId)) {
      throw apiError(NotFoundException, 'COMMENT_NOT_FOUND');
    }

    await this.commentRepository.delete({ id: commentId });
    return { id: commentId, deleted: true };
  }
}
