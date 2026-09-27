import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommentLike, EntryLike } from '@/database/entities';
import { LikesService } from './likes.service';

function createQueryBuilder() {
  const qb: Record<string, jest.Mock> = {};
  for (const method of [
    'addSelect',
    'andWhere',
    'execute',
    'getOne',
    'getRawMany',
    'groupBy',
    'innerJoin',
    'insert',
    'into',
    'orIgnore',
    'select',
    'setParameter',
    'values',
    'where',
  ]) {
    qb[method] = jest.fn(() => qb);
  }
  return qb;
}

describe('LikesService', () => {
  const entryLikeRepository = { createQueryBuilder: jest.fn(), delete: jest.fn() };
  const commentLikeRepository = { createQueryBuilder: jest.fn(), delete: jest.fn() };
  const commentRepository = { createQueryBuilder: jest.fn() };
  const entryRepository = { createQueryBuilder: jest.fn() };
  let entryQb: Record<string, jest.Mock>;
  let service: LikesService;

  beforeEach(() => {
    jest.clearAllMocks();
    entryQb = createQueryBuilder();
    entryQb.getOne.mockResolvedValue({ id: 8, userId: 5 });
    entryRepository.createQueryBuilder.mockReturnValue(entryQb);
    service = new LikesService(
      entryLikeRepository as never,
      commentLikeRepository as never,
      commentRepository as never,
      entryRepository as never,
    );
  });

  it('likes a visible entry idempotently and returns the fresh state', async () => {
    const insertQb = createQueryBuilder();
    const summaryQb = createQueryBuilder();
    summaryQb.getRawMany.mockResolvedValue([{ targetId: '8', likeCount: '3', liked: true }]);
    entryLikeRepository.createQueryBuilder
      .mockReturnValueOnce(insertQb)
      .mockReturnValueOnce(summaryQb);

    await expect(service.setEntryLike(7, 8, true)).resolves.toEqual({ liked: true, likeCount: 3 });
    expect(insertQb.into).toHaveBeenCalledWith(EntryLike);
    expect(insertQb.values).toHaveBeenCalledWith({ entryId: 8, userId: 7 });
    expect(insertQb.orIgnore).toHaveBeenCalled();
    expect(summaryQb.where).toHaveBeenCalledWith('l.entry_id IN (:...targetIds)', {
      targetIds: [8],
    });
    expect(summaryQb.andWhere).toHaveBeenCalledWith('u.deleted_at IS NULL');
    expect(summaryQb.setParameter).toHaveBeenCalledWith('userId', 7);
  });

  it('unlikes an entry and reports zero likes when none remain', async () => {
    const summaryQb = createQueryBuilder();
    summaryQb.getRawMany.mockResolvedValue([]);
    entryLikeRepository.createQueryBuilder.mockReturnValue(summaryQb);

    await expect(service.setEntryLike(7, 8, false)).resolves.toEqual({
      liked: false,
      likeCount: 0,
    });
    expect(entryLikeRepository.delete).toHaveBeenCalledWith({ entryId: 8, userId: 7 });
  });

  it('refuses self-likes and invisible entries', async () => {
    await expect(service.setEntryLike(5, 8, true)).rejects.toBeInstanceOf(BadRequestException);
    entryQb.getOne.mockResolvedValue(null);
    await expect(service.setEntryLike(7, 8, true)).rejects.toBeInstanceOf(NotFoundException);
    expect(entryLikeRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('likes and unlikes a comment by someone else on a visible entry', async () => {
    const commentQb = createQueryBuilder();
    commentQb.getOne.mockResolvedValue({ id: 3, userId: 9 });
    commentRepository.createQueryBuilder.mockReturnValue(commentQb);
    const insertQb = createQueryBuilder();
    const summaryQb = createQueryBuilder();
    summaryQb.getRawMany.mockResolvedValue([{ targetId: 3, likeCount: 1, liked: true }]);
    commentLikeRepository.createQueryBuilder
      .mockReturnValueOnce(insertQb)
      .mockReturnValue(summaryQb);

    await expect(service.setCommentLike(7, 8, 3, true)).resolves.toEqual({
      liked: true,
      likeCount: 1,
    });
    expect(commentQb.andWhere).toHaveBeenCalledWith('c.entry_id = :entryId', { entryId: 8 });
    expect(insertQb.into).toHaveBeenCalledWith(CommentLike);
    expect(insertQb.values).toHaveBeenCalledWith({ commentId: 3, userId: 7 });

    await service.setCommentLike(7, 8, 3, false);
    expect(commentLikeRepository.delete).toHaveBeenCalledWith({ commentId: 3, userId: 7 });
  });

  it('refuses own and missing comments', async () => {
    const commentQb = createQueryBuilder();
    commentRepository.createQueryBuilder.mockReturnValue(commentQb);

    commentQb.getOne.mockResolvedValue({ id: 3, userId: 7 });
    await expect(service.setCommentLike(7, 8, 3, true)).rejects.toBeInstanceOf(BadRequestException);
    commentQb.getOne.mockResolvedValue(null);
    await expect(service.setCommentLike(7, 8, 3, true)).rejects.toBeInstanceOf(NotFoundException);
    expect(commentLikeRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('skips the summary query when there is nothing to summarize', async () => {
    await expect(service.summarizeCommentLikes(7, [])).resolves.toEqual(new Map());
    expect(commentLikeRepository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
