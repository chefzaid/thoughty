import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  excludeUnreadable,
  findFeedVisibleEntry,
  readableBy,
} from './public-feed-visibility';

function createQueryBuilder() {
  const qb: Record<string, jest.Mock> = {};
  for (const method of ['andWhere', 'innerJoin', 'select', 'where']) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getOne = jest.fn();
  qb.getExists = jest.fn();
  return qb;
}

describe('public feed visibility', () => {
  const entryRepository = { createQueryBuilder: jest.fn() };
  const readableCondition = (qb: Record<string, jest.Mock>) =>
    qb.andWhere.mock.calls.filter(([sql]) => String(sql).includes('followers_by_approval'));

  beforeEach(() => jest.clearAllMocks());

  it('reads a writer as readable when it is the viewer, they do not approve followers, or approved the viewer', () => {
    const sql = readableBy('e.user_id');
    expect(sql).toContain('e.user_id = :viewerId');
    expect(sql).toContain('aw.followers_by_approval');
    expect(sql).toContain("af.status = 'approved'");
    expect(readableBy('e.user_id', 'userId')).toContain('af.follower_id = :userId');

    const qb = createQueryBuilder();
    excludeUnreadable(qb as never, 'e.user_id', 4);
    expect(qb.andWhere).toHaveBeenCalledWith(readableBy('e.user_id'), { viewerId: 4 });
  });

  it('finds an entry the viewer may read in one query', async () => {
    const qb = createQueryBuilder();
    qb.getOne.mockResolvedValue({ id: 8, userId: 5, commentPolicy: null });
    entryRepository.createQueryBuilder.mockReturnValue(qb);

    await expect(findFeedVisibleEntry(entryRepository as never, 8, 7)).resolves.toEqual({
      id: 8,
      userId: 5,
      commentPolicy: null,
    });
    expect(readableCondition(qb)).toHaveLength(1);
    expect(qb.getExists).not.toHaveBeenCalled();
  });

  it('answers FOLLOW_APPROVAL_REQUIRED for an entry shown only as a teaser, and missing for anything else', async () => {
    const readable = createQueryBuilder();
    const visible = createQueryBuilder();
    readable.getOne.mockResolvedValue(null);
    visible.getExists.mockResolvedValue(true);
    entryRepository.createQueryBuilder.mockReturnValueOnce(readable).mockReturnValueOnce(visible);

    const teaser = findFeedVisibleEntry(entryRepository as never, 8, 7);
    await expect(teaser).rejects.toBeInstanceOf(ForbiddenException);
    await expect(teaser).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FOLLOW_APPROVAL_REQUIRED' }),
    });
    expect(readableCondition(visible)).toHaveLength(0);

    visible.getExists.mockResolvedValue(false);
    entryRepository.createQueryBuilder.mockReturnValueOnce(readable).mockReturnValueOnce(visible);
    await expect(findFeedVisibleEntry(entryRepository as never, 8, 7)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets a like or a save made before be taken back from a teaser', async () => {
    const qb = createQueryBuilder();
    qb.getOne.mockResolvedValueOnce({ id: 8, userId: 5 }).mockResolvedValueOnce(null);
    entryRepository.createQueryBuilder.mockReturnValue(qb);

    await expect(findFeedVisibleEntry(entryRepository as never, 8, 7, { readable: false })).resolves.toEqual({
      id: 8,
      userId: 5,
    });
    expect(readableCondition(qb)).toHaveLength(0);
    await expect(
      findFeedVisibleEntry(entryRepository as never, 8, 7, { readable: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(qb.getExists).not.toHaveBeenCalled();
  });
});
