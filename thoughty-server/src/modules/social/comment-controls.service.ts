import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { type CommentPolicy, Entry, EntryComment } from '@/database/entities';
import { toCommentDto } from './comments.service';
import { LikesService } from './likes.service';
import { findFeedVisibleEntry } from './public-feed-visibility';
import type { EntryCommentDto, EntryCommentPolicyDto } from './dto';

/**
 * What the writer of a public entry controls about its comments: who may comment, and which comments
 * are hidden (seen only by the writer and the comment's own writer) or pinned on top.
 */
@Injectable()
export class CommentControlsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(EntryComment)
    private readonly commentRepository: Repository<EntryComment>,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    private readonly likesService: LikesService,
  ) {}

  async setPolicy(
    userId: number,
    entryId: number,
    policy: CommentPolicy,
  ): Promise<EntryCommentPolicyDto> {
    await this.findOwnEntry(userId, entryId);
    await this.entryRepository.update({ id: entryId, userId }, { commentPolicy: policy });
    return { commentPolicy: policy, canComment: policy !== 'closed' };
  }

  /** Hiding a pinned comment also takes it off the top. */
  async setHidden(
    userId: number,
    entryId: number,
    commentId: number,
    hidden: boolean,
  ): Promise<EntryCommentDto> {
    await this.findOwnEntry(userId, entryId);
    await this.findComment(this.commentRepository, entryId, commentId);
    await this.commentRepository.update(
      { id: commentId },
      hidden ? { hiddenAt: new Date(), pinnedAt: null } : { hiddenAt: null },
    );
    return this.describe(userId, entryId, commentId);
  }

  /** Pinning a comment takes any other one on the entry off the top; a hidden comment must be shown first. */
  async setPinned(
    userId: number,
    entryId: number,
    commentId: number,
    pinned: boolean,
  ): Promise<EntryCommentDto> {
    await this.findOwnEntry(userId, entryId);
    await this.dataSource.transaction(async (manager) => {
      // One pin at a time per entry: two pins at once wait for each other instead of breaking the unique index
      await manager.query('SELECT id FROM entries WHERE id = $1 FOR UPDATE', [entryId]);
      const comments = manager.getRepository(EntryComment);
      const comment = await this.findComment(comments, entryId, commentId);
      if (!pinned) {
        await comments.update({ id: commentId }, { pinnedAt: null });
        return;
      }
      if (comment.hiddenAt) {
        throw apiError(BadRequestException, 'COMMENT_PIN_HIDDEN');
      }
      await comments.update(
        { entryId, pinnedAt: Not(IsNull()), id: Not(commentId) },
        { pinnedAt: null },
      );
      await comments.update({ id: commentId }, { pinnedAt: new Date() });
    });
    return this.describe(userId, entryId, commentId);
  }

  /** Only the entry's writer controls its comments; to anyone else the entry is not there. */
  private async findOwnEntry(userId: number, entryId: number): Promise<void> {
    const entry = await findFeedVisibleEntry(this.entryRepository, entryId);
    if (entry.userId !== userId) {
      throw apiError(NotFoundException, 'ENTRY_NOT_FOUND');
    }
  }

  private async findComment(
    repository: Repository<EntryComment>,
    entryId: number,
    commentId: number,
  ): Promise<EntryComment> {
    const comment = await repository
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.user', 'u')
      .where('c.id = :commentId', { commentId })
      .andWhere('c.entry_id = :entryId', { entryId })
      .andWhere('u.deleted_at IS NULL')
      .getOne();
    if (!comment) {
      throw apiError(NotFoundException, 'COMMENT_NOT_FOUND');
    }
    return comment;
  }

  private async describe(
    userId: number,
    entryId: number,
    commentId: number,
  ): Promise<EntryCommentDto> {
    const [comment, likes] = await Promise.all([
      this.findComment(this.commentRepository, entryId, commentId),
      this.likesService.summarizeCommentLikes(userId, [commentId]),
    ]);
    return toCommentDto(comment, userId, userId, likes.get(commentId));
  }
}
