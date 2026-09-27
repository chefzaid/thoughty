import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry, EntryComment } from '@/database/entities';
import { LikesService, type LikeSummary } from './likes.service';
import { findFeedVisibleEntry } from './public-feed-visibility';
import type { EntryCommentDeletedDto, EntryCommentDto, EntryCommentsResponseDto } from './dto';

/** Newest comments returned per entry; older ones are counted in `total`. */
export const MAX_LISTED_COMMENTS = 100;

function toCommentDto(
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
  ) {}

  async list(userId: number, entryId: number): Promise<EntryCommentsResponseDto> {
    const entry = await findFeedVisibleEntry(this.entryRepository, entryId);
    const [comments, total] = await this.commentRepository
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.user', 'u')
      .select(['c.id', 'c.userId', 'c.content', 'c.createdAt', 'u.id', 'u.username', 'u.avatarUrl'])
      .where('c.entry_id = :entryId', { entryId })
      .andWhere('u.deleted_at IS NULL')
      .orderBy('c.createdAt', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .take(MAX_LISTED_COMMENTS)
      .getManyAndCount();

    const likes = await this.likesService.summarizeCommentLikes(
      userId,
      comments.map((comment) => comment.id),
    );
    return {
      comments: comments
        .reverse()
        .map((comment) => toCommentDto(comment, userId, entry.userId, likes.get(comment.id))),
      total,
    };
  }

  async create(userId: number, entryId: number, content: string): Promise<EntryCommentDto> {
    const entry = await findFeedVisibleEntry(this.entryRepository, entryId);
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
      throw new NotFoundException('Comment not found');
    }

    await this.commentRepository.delete({ id: commentId });
    return { id: commentId, deleted: true };
  }
}
