import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserFollow } from '@/database/entities';
import { FollowsService } from './follows.service';

function createQueryBuilder() {
  const qb: Record<string, jest.Mock> = {};
  for (const method of [
    'andWhere',
    'execute',
    'getCount',
    'getExists',
    'getMany',
    'innerJoin',
    'innerJoinAndSelect',
    'insert',
    'into',
    'orIgnore',
    'orderBy',
    'select',
    'values',
    'where',
  ]) {
    qb[method] = jest.fn(() => qb);
  }
  return qb;
}

describe('FollowsService', () => {
  const followRepository = { createQueryBuilder: jest.fn(), delete: jest.fn() };
  const entryRepository = { createQueryBuilder: jest.fn() };
  let service: FollowsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FollowsService(followRepository as never, entryRepository as never);
  });

  it('lists active followed users alphabetically with the active follower count', async () => {
    const listQb = createQueryBuilder();
    const countQb = createQueryBuilder();
    listQb.getMany.mockResolvedValue([
      {
        followedId: 2,
        createdAt: new Date('2026-09-01T08:30:00Z'),
        followed: { id: 2, username: 'maya', avatarUrl: null, email: 'maya@example.com' },
      },
    ]);
    countQb.getCount.mockResolvedValue(3);
    followRepository.createQueryBuilder.mockReturnValueOnce(listQb).mockReturnValueOnce(countQb);

    await expect(service.list(1)).resolves.toEqual({
      following: [
        { id: 2, username: 'maya', avatarUrl: null, followedAt: '2026-09-01T08:30:00.000Z' },
      ],
      followerCount: 3,
    });
    expect(listQb.where).toHaveBeenCalledWith('f.follower_id = :userId', { userId: 1 });
    expect(listQb.andWhere).toHaveBeenCalledWith('u.deleted_at IS NULL');
    expect(listQb.orderBy).toHaveBeenCalledWith('u.username', 'ASC');
    expect(countQb.where).toHaveBeenCalledWith('f.followed_id = :userId', { userId: 1 });
    expect(countQb.andWhere).toHaveBeenCalledWith('u.deleted_at IS NULL');
  });

  it('refuses to follow yourself', async () => {
    await expect(service.follow(3, 3)).rejects.toBeInstanceOf(BadRequestException);
    expect(entryRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('only follows authors with feed-visible public entries', async () => {
    const entryQb = createQueryBuilder();
    entryQb.getExists.mockResolvedValue(false);
    entryRepository.createQueryBuilder.mockReturnValue(entryQb);

    await expect(service.follow(1, 5)).rejects.toBeInstanceOf(NotFoundException);
    expect(entryQb.where).toHaveBeenCalledWith('e.user_id = :targetUserId', { targetUserId: 5 });
    expect(entryQb.andWhere).toHaveBeenCalledWith('e.visibility = :visibility', {
      visibility: 'public',
    });
    expect(entryQb.andWhere).toHaveBeenCalledWith('u.deleted_at IS NULL');
    expect(followRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('follows a public author idempotently', async () => {
    const entryQb = createQueryBuilder();
    const insertQb = createQueryBuilder();
    entryQb.getExists.mockResolvedValue(true);
    entryRepository.createQueryBuilder.mockReturnValue(entryQb);
    followRepository.createQueryBuilder.mockReturnValue(insertQb);

    await expect(service.follow(1, 2)).resolves.toEqual({ userId: 2, following: true });
    expect(insertQb.into).toHaveBeenCalledWith(UserFollow);
    expect(insertQb.values).toHaveBeenCalledWith({ followerId: 1, followedId: 2 });
    expect(insertQb.orIgnore).toHaveBeenCalled();
  });

  it('unfollows without requiring the author to still be public', async () => {
    followRepository.delete.mockResolvedValue({ affected: 0 });

    await expect(service.unfollow(1, 2)).resolves.toEqual({ userId: 2, following: false });
    expect(followRepository.delete).toHaveBeenCalledWith({ followerId: 1, followedId: 2 });
  });
});
