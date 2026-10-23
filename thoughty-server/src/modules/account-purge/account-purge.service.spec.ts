import { Logger } from '@nestjs/common';
import { Attachment, User } from '@/database/entities';
import {
  AccountPurgeService,
  DEFAULT_ACCOUNT_PURGE_AFTER_DAYS,
  resolveAccountPurgeAfterDays,
} from './account-purge.service';

const DAY_MS = 24 * 60 * 60 * 1000;

function queryBuilder(result: { getMany?: jest.Mock; getOne?: jest.Mock }) {
  const qb: Record<string, jest.Mock> = {};
  for (const method of ['select', 'where', 'andWhere', 'orderBy', 'limit', 'setLock', 'setOnLocked']) {
    qb[method] = jest.fn(() => qb);
  }
  return Object.assign(qb, result);
}

describe('resolveAccountPurgeAfterDays', () => {
  it('defaults to 30 days and accepts whole numbers of at least one day', () => {
    expect(resolveAccountPurgeAfterDays(undefined)).toBe(DEFAULT_ACCOUNT_PURGE_AFTER_DAYS);
    expect(resolveAccountPurgeAfterDays('  ')).toBe(30);
    expect(resolveAccountPurgeAfterDays(' 7 ')).toBe(7);
    for (const invalid of ['0', '-3', '1.5', 'thirty']) {
      expect(resolveAccountPurgeAfterDays(invalid)).toBeNull();
    }
  });
});

describe('AccountPurgeService', () => {
  const originalDays = process.env.ACCOUNT_PURGE_AFTER_DAYS;
  const now = new Date('2026-10-23T12:00:00Z');
  let calls: string[];
  let listUsers: jest.Mock;
  let lockUser: jest.Mock;
  let lockedQueries: Array<ReturnType<typeof queryBuilder>>;
  let listQueries: Array<ReturnType<typeof queryBuilder>>;
  let manager: { getRepository: jest.Mock; find: jest.Mock; delete: jest.Mock };
  let attachmentsService: { removeStoredFiles: jest.Mock };
  let dataSource: { getRepository: jest.Mock; transaction: jest.Mock };

  beforeEach(() => {
    delete process.env.ACCOUNT_PURGE_AFTER_DAYS;
    calls = [];
    lockedQueries = [];
    listQueries = [];
    listUsers = jest.fn().mockResolvedValue([]);
    lockUser = jest.fn(async () => ({ id: 0 }));
    manager = {
      getRepository: jest.fn(() => ({
        createQueryBuilder: jest.fn(() => {
          const qb = queryBuilder({ getOne: lockUser });
          lockedQueries.push(qb);
          return qb;
        }),
      })),
      find: jest.fn(async (_entity: unknown, options: { where: { userId: number } }) => {
        calls.push(`list files ${options.where.userId}`);
        return [{ id: 1, storedFilename: `${options.where.userId}-a.jpg` }, { id: 2, storedFilename: `${options.where.userId}-b.m4a` }];
      }),
      delete: jest.fn(async (_entity: unknown, where: { id: number }) => {
        calls.push(`delete user ${where.id}`);
      }),
    };
    attachmentsService = {
      removeStoredFiles: jest.fn(async (names: string[]) => {
        calls.push(`remove ${names.join(' ')}`);
        return [] as string[];
      }),
    };
    dataSource = {
      getRepository: jest.fn(() => ({
        createQueryBuilder: jest.fn(() => {
          const qb = queryBuilder({ getMany: listUsers });
          listQueries.push(qb);
          return qb;
        }),
      })),
      transaction: jest.fn(async (work: (m: typeof manager) => Promise<unknown>) => work(manager)),
    };
  });

  afterEach(() => {
    if (originalDays === undefined) delete process.env.ACCOUNT_PURGE_AFTER_DAYS;
    else process.env.ACCOUNT_PURGE_AFTER_DAYS = originalDays;
    jest.restoreAllMocks();
  });

  const createService = () => new AccountPurgeService(dataSource as never, attachmentsService as never);

  it('removes every stored file of an expired account before deleting its row', async () => {
    listUsers.mockResolvedValueOnce([{ id: 4 }, { id: 9 }]);

    await expect(createService().purgeExpired(now)).resolves.toEqual({ purgedUserIds: [4, 9], failedUserIds: [] });

    expect(calls).toEqual([
      'list files 4', 'remove 4-a.jpg 4-b.m4a', 'delete user 4',
      'list files 9', 'remove 9-a.jpg 9-b.m4a', 'delete user 9',
    ]);
    expect(manager.find).toHaveBeenCalledWith(Attachment, expect.objectContaining({ where: { userId: 4 } }));
    expect(manager.delete).toHaveBeenCalledWith(User, { id: 4 });
    expect(dataSource.transaction).toHaveBeenCalledTimes(2);
  });

  it('only takes accounts deleted before the grace period, and locks each one without waiting', async () => {
    process.env.ACCOUNT_PURGE_AFTER_DAYS = '7';
    listUsers.mockResolvedValueOnce([{ id: 4 }]);
    const service = createService();
    expect(service.purgeAfterDays).toBe(7);

    await service.purgeExpired(now);

    const cutoff = new Date(now.getTime() - 7 * DAY_MS);
    expect(listQueries[0].andWhere).toHaveBeenCalledWith('u.deleted_at <= :cutoff', { cutoff });
    expect(lockedQueries[0].where).toHaveBeenCalledWith('u.id = :userId', { userId: 4 });
    expect(lockedQueries[0].andWhere).toHaveBeenCalledWith('u.deleted_at IS NOT NULL');
    expect(lockedQueries[0].andWhere).toHaveBeenCalledWith('u.deleted_at <= :cutoff', { cutoff });
    expect(lockedQueries[0].setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(lockedQueries[0].setOnLocked).toHaveBeenCalledWith('skip_locked');
  });

  it('falls back to 30 days when the setting is invalid', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    process.env.ACCOUNT_PURGE_AFTER_DAYS = '0';

    expect(createService().purgeAfterDays).toBe(30);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ACCOUNT_PURGE_AFTER_DAYS'));
  });

  it('skips an account another run holds or that was already purged, touching none of its files', async () => {
    listUsers.mockResolvedValueOnce([{ id: 4 }]);
    lockUser.mockResolvedValueOnce(null);

    await expect(createService().purgeExpired(now)).resolves.toEqual({ purgedUserIds: [], failedUserIds: [] });
    expect(attachmentsService.removeStoredFiles).not.toHaveBeenCalled();
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('keeps going past an account that fails and reports it by id', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    listUsers.mockResolvedValueOnce([{ id: 4 }, { id: 9 }]);
    manager.delete.mockRejectedValueOnce(new Error('foreign key violation'));

    await expect(createService().purgeExpired(now)).resolves.toEqual({ purgedUserIds: [9], failedUserIds: [4] });
    expect(error).toHaveBeenCalledWith('Failed to purge deleted account 4', expect.stringContaining('foreign key violation'));
  });

  it('keeps an account whose files could not all be deleted, so the next run retries it', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    listUsers.mockResolvedValueOnce([{ id: 4 }]);
    attachmentsService.removeStoredFiles.mockResolvedValueOnce(['4/lost.png']);

    await expect(createService().purgeExpired(now)).resolves.toEqual({ purgedUserIds: [], failedUserIds: [4] });
    expect(manager.delete).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('Failed to purge deleted account 4', expect.stringContaining('could not be deleted'));
  });

  it('works through the backlog in batches by id', async () => {
    const firstBatch = Array.from({ length: 50 }, (_, index) => ({ id: index + 1 }));
    listUsers.mockResolvedValueOnce(firstBatch).mockResolvedValueOnce([{ id: 77 }]);

    const result = await createService().purgeExpired(now);

    expect(result.purgedUserIds).toHaveLength(51);
    expect(listQueries).toHaveLength(2);
    expect(listQueries[0].andWhere).toHaveBeenCalledWith('u.id > :afterId', { afterId: 0 });
    expect(listQueries[1].andWhere).toHaveBeenCalledWith('u.id > :afterId', { afterId: 50 });
    expect(listQueries[0].limit).toHaveBeenCalledWith(50);
  });
});
