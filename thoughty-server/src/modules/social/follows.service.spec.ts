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
  const topicFollowsService = { list: jest.fn() };
  let service: FollowsService;

  beforeEach(() => {
    jest.clearAllMocks();
    topicFollowsService.list.mockResolvedValue([]);
    service = new FollowsService(followRepository as never, entryRepository as never, topicFollowsService as never);
  });

  it('lists active followed users and followers alphabetically, the topics followed and the follower count', async () => {
    const listQb = createQueryBuilder();
    const followersQb = createQueryBuilder();
    listQb.getMany.mockResolvedValue([
      {
        followedId: 2,
        createdAt: new Date('2026-09-01T08:30:00Z'),
        followed: { id: 2, username: 'maya', avatarUrl: null, email: 'maya@example.com' },
      },
    ]);
    followersQb.getMany.mockResolvedValue([
      {
        followerId: 4,
        createdAt: new Date('2026-09-03T08:30:00Z'),
        follower: { id: 4, username: 'noor', avatarUrl: '/a.png', email: 'noor@example.com' },
      },
    ]);
    followRepository.createQueryBuilder.mockReturnValueOnce(listQb).mockReturnValueOnce(followersQb);
    const topics = [{ tag: 'gratitude', followedAt: '2026-09-02T08:30:00.000Z' }];
    topicFollowsService.list.mockResolvedValue(topics);

    await expect(service.list(1)).resolves.toEqual({
      following: [
        { id: 2, username: 'maya', avatarUrl: null, followedAt: '2026-09-01T08:30:00.000Z' },
      ],
      topics,
      followers: [
        { id: 4, username: 'noor', avatarUrl: '/a.png', followedAt: '2026-09-03T08:30:00.000Z' },
      ],
      followerCount: 1,
    });
    expect(topicFollowsService.list).toHaveBeenCalledWith(1);
    expect(listQb.where).toHaveBeenCalledWith('f.follower_id = :userId', { userId: 1 });
    expect(listQb.andWhere).toHaveBeenCalledWith('u.deleted_at IS NULL');
    expect(listQb.orderBy).toHaveBeenCalledWith('u.username', 'ASC');
    expect(followersQb.innerJoinAndSelect).toHaveBeenCalledWith('f.follower', 'u');
    expect(followersQb.where).toHaveBeenCalledWith('f.followed_id = :userId', { userId: 1 });
    expect(followersQb.andWhere).toHaveBeenCalledWith('u.deleted_at IS NULL');
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
    // A writer blocked either way is not there to follow
    expect(entryQb.andWhere).toHaveBeenCalledWith(expect.stringContaining('user_blocks'), { viewerId: 1 });
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

  it('removes a follower quietly', async () => {
    followRepository.delete.mockResolvedValue({ affected: 1 });

    await expect(service.removeFollower(1, 4)).resolves.toEqual({ userId: 4, following: false });
    expect(followRepository.delete).toHaveBeenCalledWith({ followerId: 4, followedId: 1 });
  });

  it('counts only active followers', async () => {
    const countQb = createQueryBuilder();
    countQb.getCount.mockResolvedValue(4);
    followRepository.createQueryBuilder.mockReturnValue(countQb);

    await expect(service.countFollowers(1)).resolves.toBe(4);
    expect(countQb.innerJoin).toHaveBeenCalledWith('f.follower', 'u');
    expect(countQb.andWhere).toHaveBeenCalledWith('u.deleted_at IS NULL');
  });
});
