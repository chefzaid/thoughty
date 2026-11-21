import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IsNull, Not } from 'typeorm';
import { CommentControlsService } from './comment-controls.service';

function createQueryBuilder() {
  const qb: Record<string, jest.Mock> = {};
  for (const method of [
    'andWhere',
    'getOne',
    'innerJoin',
    'innerJoinAndSelect',
    'select',
    'where',
  ]) {
    qb[method] = jest.fn(() => qb);
  }
  return qb;
}

const comment = (flags: { hiddenAt?: Date | null; pinnedAt?: Date | null } = {}) => ({
  id: 3,
  userId: 9,
  entryId: 8,
  content: 'Nice',
  createdAt: new Date('2026-09-01T10:00:00Z'),
  hiddenAt: flags.hiddenAt ?? null,
  pinnedAt: flags.pinnedAt ?? null,
  user: { id: 9, username: 'maya', avatarUrl: null },
});

describe('CommentControlsService', () => {
  const entryQb = createQueryBuilder();
  const commentQb = createQueryBuilder();
  const entryRepository = { createQueryBuilder: jest.fn(() => entryQb), update: jest.fn() };
  const commentRepository = { createQueryBuilder: jest.fn(() => commentQb), update: jest.fn() };
  const manager = { query: jest.fn(), getRepository: jest.fn(() => commentRepository) };
  const dataSource = {
    transaction: jest.fn((work: (m: typeof manager) => Promise<unknown>) => work(manager)),
  };
  const likesService = { summarizeCommentLikes: jest.fn() };
  const service = new CommentControlsService(
    dataSource as never,
    commentRepository as never,
    entryRepository as never,
    likesService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    entryQb.getOne.mockResolvedValue({ id: 8, userId: 5, commentPolicy: null });
    commentQb.getOne.mockResolvedValue(comment());
    likesService.summarizeCommentLikes.mockResolvedValue(
      new Map([[3, { likeCount: 2, liked: false }]]),
    );
  });

  it('sets who may comment on the writer’s own public entry', async () => {
    await expect(service.setPolicy(5, 8, 'closed')).resolves.toEqual({
      commentPolicy: 'closed',
      canComment: false,
    });
    expect(entryRepository.update).toHaveBeenCalledWith(
      { id: 8, userId: 5 },
      { commentPolicy: 'closed' },
    );
    await expect(service.setPolicy(5, 8, 'followers')).resolves.toEqual({
      commentPolicy: 'followers',
      canComment: true,
    });
    expect(entryQb.andWhere).toHaveBeenCalledWith('e.visibility = :visibility', {
      visibility: 'public',
    });
  });

  it('answers anyone else as if the entry were not there', async () => {
    await expect(service.setPolicy(7, 8, 'closed')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.setHidden(7, 8, 3, true)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.setPinned(7, 8, 3, true)).rejects.toBeInstanceOf(NotFoundException);
    entryQb.getOne.mockResolvedValue(null);
    await expect(service.setPolicy(5, 8, 'closed')).rejects.toBeInstanceOf(NotFoundException);
    expect(entryRepository.update).not.toHaveBeenCalled();
    expect(commentRepository.update).not.toHaveBeenCalled();
  });

  it('hides a comment, taking it off the top, and shows it again', async () => {
    const hiddenAt = new Date();
    commentQb.getOne.mockResolvedValueOnce(comment()).mockResolvedValueOnce(comment({ hiddenAt }));

    await expect(service.setHidden(5, 8, 3, true)).resolves.toEqual(
      expect.objectContaining({
        id: 3,
        hidden: true,
        pinned: false,
        canDelete: true,
        likeCount: 2,
      }),
    );
    expect(commentRepository.update).toHaveBeenCalledWith(
      { id: 3 },
      { hiddenAt: expect.any(Date), pinnedAt: null },
    );
    expect(commentQb.andWhere).toHaveBeenCalledWith('c.entry_id = :entryId', { entryId: 8 });
    expect(commentQb.andWhere).toHaveBeenCalledWith('u.deleted_at IS NULL');

    await service.setHidden(5, 8, 3, false);
    expect(commentRepository.update).toHaveBeenLastCalledWith({ id: 3 }, { hiddenAt: null });
  });

  it('refuses a comment that is not on the entry', async () => {
    commentQb.getOne.mockResolvedValue(null);

    await expect(service.setHidden(5, 8, 3, true)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.setPinned(5, 8, 3, false)).rejects.toBeInstanceOf(NotFoundException);
    expect(commentRepository.update).not.toHaveBeenCalled();
  });

  it('pins one comment at a time under a lock on the entry', async () => {
    const pinnedAt = new Date();
    commentQb.getOne.mockResolvedValueOnce(comment()).mockResolvedValueOnce(comment({ pinnedAt }));

    await expect(service.setPinned(5, 8, 3, true)).resolves.toEqual(
      expect.objectContaining({ id: 3, pinned: true }),
    );
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT id FROM entries WHERE id = $1 FOR UPDATE',
      [8],
    );
    expect(commentRepository.update).toHaveBeenNthCalledWith(
      1,
      { entryId: 8, pinnedAt: Not(IsNull()), id: Not(3) },
      { pinnedAt: null },
    );
    expect(commentRepository.update).toHaveBeenNthCalledWith(
      2,
      { id: 3 },
      { pinnedAt: expect.any(Date) },
    );
  });

  it('unpins a comment, and refuses to pin a hidden one', async () => {
    await service.setPinned(5, 8, 3, false);
    expect(commentRepository.update).toHaveBeenCalledWith({ id: 3 }, { pinnedAt: null });

    commentRepository.update.mockClear();
    commentQb.getOne.mockResolvedValue(comment({ hiddenAt: new Date() }));
    const refusal = service.setPinned(5, 8, 3, true);
    await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
    await expect(refusal).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COMMENT_PIN_HIDDEN' }),
    });
    expect(commentRepository.update).not.toHaveBeenCalled();
  });
});
