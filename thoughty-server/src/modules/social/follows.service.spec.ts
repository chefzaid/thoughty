import { BadRequestException, NotFoundException } from '@nestjs/common';
import { User, UserFollow } from '@/database/entities';
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
  const manager = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    query: jest.fn(),
    update: jest.fn(),
  };
  const followRepository = {
    createQueryBuilder: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    update: jest.fn(),
    manager: { transaction: jest.fn((work: (inner: typeof manager) => unknown) => work(manager)) },
  };
  const entryRepository = { createQueryBuilder: jest.fn() };
  const userRepository = { findOne: jest.fn() };
  const topicFollowsService = { list: jest.fn() };
  let service: FollowsService;

  beforeEach(() => {
    jest.clearAllMocks();
    topicFollowsService.list.mockResolvedValue([]);
    userRepository.findOne.mockResolvedValue({ id: 1, followersByApproval: false });
    service = new FollowsService(
      followRepository as never,
      entryRepository as never,
      userRepository as never,
      topicFollowsService as never,
    );
  });

  it('lists active followed users and followers alphabetically, the requests both ways, the topics and the follower count', async () => {
    const listQb = createQueryBuilder();
    const followersQb = createQueryBuilder();
    listQb.getMany.mockResolvedValue([
      {
        followedId: 2,
        status: 'approved',
        createdAt: new Date('2026-09-01T08:30:00Z'),
        followed: { id: 2, username: 'maya', avatarUrl: null, email: 'maya@example.com' },
      },
      {
        followedId: 6,
        status: 'pending',
        createdAt: new Date('2026-09-05T08:30:00Z'),
        followed: { id: 6, username: 'omar', avatarUrl: null, email: 'omar@example.com' },
      },
    ]);
    followersQb.getMany.mockResolvedValue([
      {
        followerId: 4,
        status: 'approved',
        createdAt: new Date('2026-09-03T08:30:00Z'),
        follower: { id: 4, username: 'noor', avatarUrl: '/a.png', email: 'noor@example.com' },
      },
      {
        followerId: 7,
        status: 'pending',
        createdAt: new Date('2026-09-04T08:30:00Z'),
        follower: { id: 7, username: 'pia', avatarUrl: null, email: 'pia@example.com' },
      },
    ]);
    userRepository.findOne.mockResolvedValue({ id: 1, followersByApproval: true });
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
      requested: [
        { id: 6, username: 'omar', avatarUrl: null, followedAt: '2026-09-05T08:30:00.000Z' },
      ],
      requests: [
        { id: 7, username: 'pia', avatarUrl: null, followedAt: '2026-09-04T08:30:00.000Z' },
      ],
      approvalRequired: true,
    });
    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true, followersByApproval: true },
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
    expect(followRepository.manager.transaction).not.toHaveBeenCalled();
  });

  const followAuthor = (followersByApproval: boolean | undefined, stored: { status: string } | null) => {
    const entryQb = createQueryBuilder();
    const insertQb = createQueryBuilder();
    entryQb.getExists.mockResolvedValue(true);
    entryRepository.createQueryBuilder.mockReturnValue(entryQb);
    manager.createQueryBuilder.mockReturnValue(insertQb);
    manager.query.mockResolvedValue(followersByApproval === undefined ? [] : [{ followers_by_approval: followersByApproval }]);
    manager.findOne.mockResolvedValue(stored);
    return insertQb;
  };

  it('follows a public author idempotently, reading their switch under a share lock', async () => {
    const insertQb = followAuthor(false, { status: 'approved' });

    await expect(service.follow(1, 2)).resolves.toEqual({ userId: 2, following: true, requested: false });
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('FOR SHARE'), [2]);
    expect(insertQb.into).toHaveBeenCalledWith(UserFollow);
    expect(insertQb.values).toHaveBeenCalledWith({ followerId: 1, followedId: 2, status: 'approved' });
    expect(insertQb.orIgnore).toHaveBeenCalled();
  });

  it('asks to follow an author who approves their followers', async () => {
    const insertQb = followAuthor(true, { status: 'pending' });

    await expect(service.follow(1, 2)).resolves.toEqual({ userId: 2, following: false, requested: true });
    expect(insertQb.values).toHaveBeenCalledWith({ followerId: 1, followedId: 2, status: 'pending' });
  });

  it('keeps a follow already approved when asked again, and reads a vanished row as a request', async () => {
    followAuthor(true, { status: 'approved' });
    await expect(service.follow(1, 2)).resolves.toEqual({ userId: 2, following: true, requested: false });

    const insertQb = followAuthor(undefined, null);
    await expect(service.follow(1, 2)).resolves.toEqual({ userId: 2, following: false, requested: true });
    expect(insertQb.values).toHaveBeenCalledWith({ followerId: 1, followedId: 2, status: 'approved' });
  });

  it('unfollows, or withdraws a request, without requiring the author to still be public', async () => {
    followRepository.delete.mockResolvedValue({ affected: 0 });

    await expect(service.unfollow(1, 2)).resolves.toEqual({ userId: 2, following: false, requested: false });
    expect(followRepository.delete).toHaveBeenCalledWith({ followerId: 1, followedId: 2 });
  });

  it('removes a follower, or declines a request, quietly', async () => {
    followRepository.delete.mockResolvedValue({ affected: 1 });

    await expect(service.removeFollower(1, 4)).resolves.toEqual({ userId: 4, following: false, requested: false });
    expect(followRepository.delete).toHaveBeenCalledWith({ followerId: 4, followedId: 1 });
  });

  it('approves a request waiting, and an approved follower again without a change', async () => {
    followRepository.update.mockResolvedValueOnce({ affected: 1 });
    await expect(service.approveFollower(1, 4)).resolves.toEqual({ userId: 4, following: true, requested: false });
    expect(followRepository.update).toHaveBeenCalledWith(
      { followerId: 4, followedId: 1, status: 'pending' },
      { status: 'approved' },
    );
    expect(followRepository.exists).not.toHaveBeenCalled();

    followRepository.update.mockResolvedValueOnce({ affected: 0 });
    followRepository.exists.mockResolvedValueOnce(true);
    await expect(service.approveFollower(1, 4)).resolves.toEqual({ userId: 4, following: true, requested: false });
    expect(followRepository.exists).toHaveBeenCalledWith({ where: { followerId: 4, followedId: 1 } });
  });

  it('refuses to approve someone who never asked', async () => {
    followRepository.update.mockResolvedValue({});
    followRepository.exists.mockResolvedValue(false);

    await expect(service.approveFollower(1, 9)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FOLLOW_REQUEST_NOT_FOUND' }),
    });
  });

  it('turns approval on without touching the followers, and off approving every request waiting', async () => {
    await expect(service.setApproval(1, true)).resolves.toEqual({ required: true, approved: 0 });
    expect(manager.update).toHaveBeenCalledTimes(1);
    expect(manager.update).toHaveBeenCalledWith(User, { id: 1 }, { followersByApproval: true });

    manager.update.mockResolvedValueOnce({}).mockResolvedValueOnce({ affected: 2 });
    await expect(service.setApproval(1, false)).resolves.toEqual({ required: false, approved: 2 });
    expect(manager.update).toHaveBeenLastCalledWith(
      UserFollow,
      { followedId: 1, status: 'pending' },
      { status: 'approved' },
    );

    manager.update.mockResolvedValueOnce({}).mockResolvedValueOnce({});
    await expect(service.setApproval(1, false)).resolves.toEqual({ required: false, approved: 0 });
  });

  it('counts only active, approved followers', async () => {
    const countQb = createQueryBuilder();
    countQb.getCount.mockResolvedValue(4);
    followRepository.createQueryBuilder.mockReturnValue(countQb);

    await expect(service.countFollowers(1)).resolves.toBe(4);
    expect(countQb.innerJoin).toHaveBeenCalledWith('f.follower', 'u');
    expect(countQb.andWhere).toHaveBeenCalledWith("f.status = 'approved'");
    expect(countQb.andWhere).toHaveBeenCalledWith('u.deleted_at IS NULL');
  });
});
