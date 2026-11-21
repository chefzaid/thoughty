import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommentsService, MAX_LISTED_COMMENTS } from './comments.service';

function createQueryBuilder() {
  const qb: Record<string, jest.Mock> = {};
  for (const method of [
    'addOrderBy',
    'andWhere',
    'getManyAndCount',
    'getOne',
    'innerJoin',
    'innerJoinAndSelect',
    'orderBy',
    'select',
    'take',
    'where',
  ]) {
    qb[method] = jest.fn(() => qb);
  }
  return qb;
}

const comment = (id: number, userId: number, username: string, flags: { hiddenAt?: Date; pinnedAt?: Date } = {}) => ({
  id,
  userId,
  entryId: 8,
  content: `Comment ${id}`,
  createdAt: new Date(`2026-09-0${id}T10:00:00Z`),
  hiddenAt: flags.hiddenAt ?? null,
  pinnedAt: flags.pinnedAt ?? null,
  user: { id: userId, username, avatarUrl: null, email: 'hidden@example.com' },
});

describe('CommentsService', () => {
  const commentRepository = {
    createQueryBuilder: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    delete: jest.fn(),
  };
  const entryRepository = { createQueryBuilder: jest.fn() };
  const likesService = { summarizeCommentLikes: jest.fn() };
  const commentPolicyService = { stateFor: jest.fn(), assertMayComment: jest.fn() };
  let entryQb: Record<string, jest.Mock>;
  let service: CommentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    entryQb = createQueryBuilder();
    entryQb.getOne.mockResolvedValue({ id: 8, userId: 5 });
    entryRepository.createQueryBuilder.mockReturnValue(entryQb);
    likesService.summarizeCommentLikes.mockResolvedValue(new Map());
    commentPolicyService.stateFor.mockResolvedValue({ commentPolicy: 'everyone', canComment: true });
    commentPolicyService.assertMayComment.mockResolvedValue(undefined);
    service = new CommentsService(
      commentRepository as never,
      entryRepository as never,
      likesService as never,
      commentPolicyService as never,
    );
  });

  it('lists the newest comments oldest first with narrow authors and delete rights', async () => {
    const qb = createQueryBuilder();
    qb.getManyAndCount.mockResolvedValue([[comment(2, 7, 'me'), comment(1, 3, 'maya')], 2]);
    commentRepository.createQueryBuilder.mockReturnValue(qb);
    likesService.summarizeCommentLikes.mockResolvedValue(
      new Map([[1, { likeCount: 3, liked: true }]]),
    );

    await expect(service.list(7, 8)).resolves.toEqual({
      comments: [
        {
          id: 1,
          content: 'Comment 1',
          createdAt: '2026-09-01T10:00:00.000Z',
          author: { id: 3, username: 'maya', avatarUrl: null },
          canDelete: false,
          likeCount: 3,
          liked: true,
          hidden: false,
          pinned: false,
        },
        {
          id: 2,
          content: 'Comment 2',
          createdAt: '2026-09-02T10:00:00.000Z',
          author: { id: 7, username: 'me', avatarUrl: null },
          canDelete: true,
          likeCount: 0,
          liked: false,
          hidden: false,
          pinned: false,
        },
      ],
      total: 2,
      commentPolicy: 'everyone',
      canComment: true,
      canModerate: false,
    });
    expect(commentPolicyService.stateFor).toHaveBeenCalledWith(7, { id: 8, userId: 5 });
    expect(likesService.summarizeCommentLikes).toHaveBeenCalledWith(7, [2, 1]);
    expect(entryQb.where).toHaveBeenCalledWith('e.id = :entryId', { entryId: 8 });
    expect(entryQb.andWhere).toHaveBeenCalledWith('e.visibility = :visibility', {
      visibility: 'public',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('u.deleted_at IS NULL');
    expect(qb.orderBy).toHaveBeenCalledWith('c.pinnedAt', 'DESC', 'NULLS LAST');
    expect(qb.addOrderBy).toHaveBeenCalledWith('c.createdAt', 'DESC');
    expect(qb.andWhere).toHaveBeenCalledWith('(c.hidden_at IS NULL OR c.user_id = :userId)', { userId: 7 });
    expect(qb.take).toHaveBeenCalledWith(MAX_LISTED_COMMENTS);
  });

  it('lets the entry owner delete any listed comment', async () => {
    const qb = createQueryBuilder();
    qb.getManyAndCount.mockResolvedValue([[comment(1, 3, 'maya')], 1]);
    commentRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.list(5, 8);

    expect(result.comments[0].canDelete).toBe(true);
    expect(result.canModerate).toBe(true);
    // The entry's writer sees the hidden comments too
    expect(qb.andWhere).not.toHaveBeenCalledWith('(c.hidden_at IS NULL OR c.user_id = :userId)', expect.anything());
  });

  it('puts the pinned comment on top and marks hidden ones', async () => {
    const qb = createQueryBuilder();
    const pinnedAt = new Date('2026-09-05T10:00:00Z');
    qb.getManyAndCount.mockResolvedValue([
      [comment(1, 3, 'maya', { pinnedAt }), comment(3, 4, 'leo', { hiddenAt: pinnedAt }), comment(2, 6, 'ana')],
      3,
    ]);
    commentRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.list(5, 8);

    expect(result.comments.map(({ id, pinned, hidden }) => ({ id, pinned, hidden }))).toEqual([
      { id: 1, pinned: true, hidden: false },
      { id: 2, pinned: false, hidden: false },
      { id: 3, pinned: false, hidden: true },
    ]);
  });

  it('hides comments of entries the feed cannot show', async () => {
    entryQb.getOne.mockResolvedValue(null);

    await expect(service.list(7, 8)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.create(7, 8, 'Hello')).rejects.toBeInstanceOf(NotFoundException);
    expect(commentRepository.save).not.toHaveBeenCalled();
  });

  it('refuses a comment its policy does not allow, before saving anything', async () => {
    commentPolicyService.assertMayComment.mockRejectedValue(new ForbiddenException());

    await expect(service.create(7, 8, 'Hello')).rejects.toBeInstanceOf(ForbiddenException);
    expect(commentPolicyService.assertMayComment).toHaveBeenCalledWith(7, { id: 8, userId: 5 });
    expect(commentRepository.save).not.toHaveBeenCalled();
  });

  it('creates a comment on a visible entry', async () => {
    commentRepository.save.mockResolvedValue({ id: 3 });
    commentRepository.findOneOrFail.mockResolvedValue(comment(3, 7, 'me'));

    await expect(service.create(7, 8, 'Comment 3')).resolves.toEqual(
      expect.objectContaining({ id: 3, content: 'Comment 3', canDelete: true }),
    );
    expect(commentRepository.create).toHaveBeenCalledWith({
      entryId: 8,
      userId: 7,
      content: 'Comment 3',
    });
    expect(commentRepository.findOneOrFail).toHaveBeenCalledWith({
      where: { id: 3 },
      relations: { user: true },
    });
  });

  it.each([
    ['the comment author', 7],
    ['the entry owner', 5],
  ])('lets %s delete a comment', async (_label, userId) => {
    commentRepository.findOne.mockResolvedValue({ ...comment(1, 7, 'me'), entry: { userId: 5 } });

    await expect(service.remove(userId, 8, 1)).resolves.toEqual({ id: 1, deleted: true });
    expect(commentRepository.findOne).toHaveBeenCalledWith({
      where: { id: 1, entryId: 8 },
      relations: { entry: true },
    });
    expect(commentRepository.delete).toHaveBeenCalledWith({ id: 1 });
  });

  it('refuses to delete comments of other people on other entries', async () => {
    commentRepository.findOne.mockResolvedValue({ ...comment(1, 7, 'me'), entry: { userId: 5 } });

    await expect(service.remove(9, 8, 1)).rejects.toBeInstanceOf(NotFoundException);
    commentRepository.findOne.mockResolvedValue(null);
    await expect(service.remove(7, 8, 99)).rejects.toBeInstanceOf(NotFoundException);
    expect(commentRepository.delete).not.toHaveBeenCalled();
  });
});
