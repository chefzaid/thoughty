import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry, EntryComment } from '@/database/entities';
import { applyPublicFeedVisibility } from '@/modules/entries/public-feed-visibility';
import type { EntryCommentDeletedDto, EntryCommentDto, EntryCommentsResponseDto } from './dto';

/** Newest comments returned per entry; older ones are counted in `total`. */
export const MAX_LISTED_COMMENTS = 100;

function toCommentDto(
  comment: EntryComment,
  currentUserId: number,
  entryOwnerId: number,
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
  };
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(EntryComment)
    private readonly commentRepository: Repository<EntryComment>,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  async list(userId: number, entryId: number): Promise<EntryCommentsResponseDto> {
    const entry = await this.findFeedVisibleEntry(entryId);
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

    return {
      comments: comments.reverse().map((comment) => toCommentDto(comment, userId, entry.userId)),
      total,
    };
  }

  async create(userId: number, entryId: number, content: string): Promise<EntryCommentDto> {
    const entry = await this.findFeedVisibleEntry(entryId);
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

  /** Comments exist only around entries the feed may show; anything else looks missing. */
  private async findFeedVisibleEntry(entryId: number): Promise<Pick<Entry, 'id' | 'userId'>> {
    const entry = await applyPublicFeedVisibility(
      this.entryRepository
        .createQueryBuilder('e')
        .innerJoin('e.user', 'u')
        .select(['e.id', 'e.userId'])
        .where('e.id = :entryId', { entryId }),
    ).getOne();
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }
    return entry;
  }
}
