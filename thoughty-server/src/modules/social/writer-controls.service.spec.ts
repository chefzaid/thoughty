import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserBlock, UserMute } from '@/database/entities';
import { WriterControlsService } from './writer-controls.service';

function createQueryBuilder() {
  const qb: Record<string, jest.Mock> = {};
  for (const method of [
    'addSelect',
    'andWhere',
    'execute',
    'getExists',
    'getRawMany',
    'innerJoin',
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

describe('WriterControlsService', () => {
  const manager = { createQueryBuilder: jest.fn(), query: jest.fn() };
  const dataSource = {
    transaction: jest.fn((work: (m: typeof manager) => unknown) => work(manager)),
  };
  const muteRepository = { createQueryBuilder: jest.fn(), delete: jest.fn() };
  const blockRepository = { createQueryBuilder: jest.fn(), delete: jest.fn() };
  const entryRepository = { createQueryBuilder: jest.fn() };
  const followRepository = { createQueryBuilder: jest.fn() };
  let entryQb: ReturnType<typeof createQueryBuilder>;
  let followQb: ReturnType<typeof createQueryBuilder>;
  let service: WriterControlsService;

  beforeEach(() => {
    jest.clearAllMocks();
    entryQb = createQueryBuilder();
    followQb = createQueryBuilder();
    entryQb.getExists.mockResolvedValue(true);
    followQb.getExists.mockResolvedValue(false);
    entryRepository.createQueryBuilder.mockReturnValue(entryQb);
    followRepository.createQueryBuilder.mockReturnValue(followQb);
    service = new WriterControlsService(
      dataSource as never,
      muteRepository as never,
      blockRepository as never,
      entryRepository as never,
      followRepository as never,
    );
  });

  it('lists active muted and blocked writers by name', async () => {
    const mutedQb = createQueryBuilder();
    const blockedQb = createQueryBuilder();
    mutedQb.getRawMany.mockResolvedValue([
      { id: '2', username: 'loud', avatarUrl: null, since: new Date('2026-09-01T08:00:00Z') },
    ]);
    blockedQb.getRawMany.mockResolvedValue([
      { id: 3, username: 'rude', avatarUrl: '/r.png', since: '2026-09-02T08:00:00.000Z' },
    ]);
    muteRepository.createQueryBuilder.mockReturnValue(mutedQb);
    blockRepository.createQueryBuilder.mockReturnValue(blockedQb);

    await expect(service.list(1)).resolves.toEqual({
      muted: [{ id: 2, username: 'loud', avatarUrl: null, since: '2026-09-01T08:00:00.000Z' }],
      blocked: [
        { id: 3, username: 'rude', avatarUrl: '/r.png', since: '2026-09-02T08:00:00.000Z' },
      ],
    });
    expect(mutedQb.where).toHaveBeenCalledWith('m.user_id = :userId', { userId: 1 });
    expect(blockedQb.where).toHaveBeenCalledWith('b.blocker_id = :userId', { userId: 1 });
    for (const qb of [mutedQb, blockedQb]) {
      expect(qb.andWhere).toHaveBeenCalledWith('u.deleted_at IS NULL');
      expect(qb.orderBy).toHaveBeenCalledWith('u.username', 'ASC');
    }
  });

  it('mutes a writer met in the feed idempotently, and unmutes without any check', async () => {
    const insertQb = createQueryBuilder();
    muteRepository.createQueryBuilder.mockReturnValue(insertQb);

    await expect(service.setMuted(1, 2, true)).resolves.toEqual({ userId: 2, muted: true });
    expect(insertQb.into).toHaveBeenCalledWith(UserMute);
    expect(insertQb.values).toHaveBeenCalledWith({ userId: 1, mutedId: 2 });
    expect(insertQb.orIgnore).toHaveBeenCalled();
    expect(entryQb.andWhere).toHaveBeenCalledWith('e.visibility = :visibility', {
      visibility: 'public',
    });

    entryRepository.createQueryBuilder.mockClear();
    await expect(service.setMuted(1, 2, false)).resolves.toEqual({ userId: 2, muted: false });
    expect(muteRepository.delete).toHaveBeenCalledWith({ userId: 1, mutedId: 2 });
    expect(entryRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('refuses to mute or block yourself', async () => {
    await expect(service.setMuted(3, 3, true)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.setBlocked(3, 3, true)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SOCIAL_CANNOT_BLOCK_SELF' }),
    });
    expect(entryRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('answers as missing for a writer the reader cannot come across', async () => {
    entryQb.getExists.mockResolvedValue(false);

    await expect(service.setMuted(1, 8, true)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.setBlocked(1, 8, true)).rejects.toBeInstanceOf(NotFoundException);
    expect(followQb.where).toHaveBeenCalledWith('f.follower_id = :targetUserId', {
      targetUserId: 8,
    });
    expect(followQb.andWhere).toHaveBeenCalledWith('f.followed_id = :userId', { userId: 1 });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('lets the reader block a follower with nothing in the feed', async () => {
    entryQb.getExists.mockResolvedValue(false);
    followQb.getExists.mockResolvedValue(true);
    const insertQb = createQueryBuilder();
    manager.createQueryBuilder.mockReturnValue(insertQb);

    await expect(service.setBlocked(1, 6, true)).resolves.toEqual({ userId: 6, blocked: true });
    expect(insertQb.into).toHaveBeenCalledWith(UserBlock);
    expect(insertQb.values).toHaveBeenCalledWith({ blockerId: 1, blockedId: 6 });
  });

  it('blocks in one transaction that ends the follows and saves both ways', async () => {
    const insertQb = createQueryBuilder();
    manager.createQueryBuilder.mockReturnValue(insertQb);

    await expect(service.setBlocked(1, 2, true)).resolves.toEqual({ userId: 2, blocked: true });
    expect(insertQb.orIgnore).toHaveBeenCalled();
    const [follows, saves] = manager.query.mock.calls;
    expect(follows[0]).toContain('DELETE FROM user_follows');
    expect(follows[0]).toContain('(follower_id = $2 AND followed_id = $1)');
    expect(saves[0]).toContain('DELETE FROM saved_entries');
    expect(saves[0]).toContain('(s.user_id = $2 AND e.user_id = $1)');
    expect(follows[1]).toEqual([1, 2]);
    expect(saves[1]).toEqual([1, 2]);
  });

  it('unblocks without bringing the follows back', async () => {
    await expect(service.setBlocked(1, 2, false)).resolves.toEqual({ userId: 2, blocked: false });
    expect(blockRepository.delete).toHaveBeenCalledWith({ blockerId: 1, blockedId: 2 });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
