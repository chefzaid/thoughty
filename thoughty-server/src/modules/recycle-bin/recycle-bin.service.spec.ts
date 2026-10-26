import { NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { Diary, Entry } from '@/database/entities';
import { purgeDateFor, RecycleBinService } from './recycle-bin.service';

type QueryBuilderMock = Record<string, jest.Mock>;

/** A query builder whose chained calls return itself and whose terminal calls resolve `result`. */
function queryBuilder(result: { many?: unknown[]; count?: number; raw?: unknown[] } = {}): QueryBuilderMock {
  const qb: QueryBuilderMock = {};
  for (const method of ['withDeleted', 'leftJoinAndSelect', 'select', 'addSelect', 'where', 'andWhere', 'orderBy', 'addOrderBy', 'skip', 'take', 'limit', 'groupBy', 'setLock', 'setOnLocked']) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }
  qb.getManyAndCount = jest.fn().mockResolvedValue([result.many ?? [], result.count ?? 0]);
  qb.getMany = jest.fn().mockResolvedValue(result.many ?? []);
  qb.getRawMany = jest.fn().mockResolvedValue(result.raw ?? []);
  return qb;
}

const trashed = (overrides: Partial<Entry> = {}): Entry => ({
  id: 12,
  userId: 7,
  diaryId: 2,
  date: '2026-10-20',
  index: 2,
  tags: ['walks'],
  content: 'By the river',
  format: 'plain',
  visibility: 'private',
  moderationStatus: 'visible',
  isFavorite: false,
  isArchived: false,
  isPinned: false,
  importRef: null,
  createdAt: new Date('2026-10-20T08:00:00Z'),
  deletedAt: new Date('2026-10-22T08:30:00Z'),
  ...overrides,
} as Entry);

describe('RecycleBinService', () => {
  let entryRepository: Record<string, jest.Mock>;
  let attachmentRepository: Record<string, jest.Mock>;
  let managerEntries: Record<string, jest.Mock>;
  let manager: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock };
  let attachmentsService: { removeStoredFiles: jest.Mock };
  let configService: { getConfig: jest.Mock };
  let cache: { invalidateUser: jest.Mock };
  let service: RecycleBinService;

  beforeEach(() => {
    entryRepository = { createQueryBuilder: jest.fn() };
    attachmentRepository = { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder()) };
    managerEntries = {
      createQueryBuilder: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    manager = {
      getRepository: jest.fn().mockReturnValue(managerEntries),
      find: jest.fn(async (target: unknown) => (target === Diary
        ? [{ id: 1, isDefault: true }, { id: 2, isDefault: false }]
        : [])),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    dataSource = { transaction: jest.fn(async (work: (value: typeof manager) => unknown) => work(manager)) };
    attachmentsService = { removeStoredFiles: jest.fn().mockResolvedValue(undefined) };
    configService = { getConfig: jest.fn().mockResolvedValue({ maxPinnedEntries: '3' }) };
    cache = { invalidateUser: jest.fn() };
    service = new RecycleBinService(
      dataSource as never,
      entryRepository as never,
      attachmentRepository as never,
      attachmentsService as never,
      configService as never,
      cache as never,
    );
  });

  describe('list', () => {
    it('pages the writer’s trashed entries, newest deletion first, with their diary, files, and purge date', async () => {
      const qb = queryBuilder({
        many: [
          trashed({ diary: { id: 2, name: 'Travel', icon: '🧭', color: '#2A9D8F' } as Diary }),
          trashed({ id: 13, diaryId: 99, diary: null }),
        ],
        count: 25,
      });
      entryRepository.createQueryBuilder.mockReturnValue(qb);
      attachmentRepository.createQueryBuilder.mockReturnValue(queryBuilder({ raw: [{ entryId: '12', count: '2' }] }));

      const result = await service.list(7, 2, 20);

      expect(qb.withDeleted).toHaveBeenCalled();
      expect(qb.where).toHaveBeenCalledWith('e.user_id = :userId', { userId: 7 });
      expect(qb.andWhere).toHaveBeenCalledWith('e.deleted_at IS NOT NULL');
      expect(qb.orderBy).toHaveBeenCalledWith('e.deletedAt', 'DESC');
      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(result).toEqual({
        entries: [
          expect.objectContaining({
            id: 12,
            diaryId: 2,
            diaryName: 'Travel',
            diaryIcon: '🧭',
            diaryColor: '#2A9D8F',
            attachmentCount: 2,
            deletedAt: '2026-10-22T08:30:00.000Z',
            purgeAt: '2026-11-21T08:30:00.000Z',
          }),
          expect.objectContaining({ id: 13, diaryId: null, diaryName: null, attachmentCount: 0 }),
        ],
        total: 25,
        page: 2,
        totalPages: 2,
        retentionDays: 30,
      });
    });

    it('reports one page for an empty bin without counting files', async () => {
      entryRepository.createQueryBuilder.mockReturnValue(queryBuilder());

      await expect(service.list(7)).resolves.toEqual(expect.objectContaining({ entries: [], total: 0, totalPages: 1 }));
      expect(attachmentRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('puts entries back at the end of their day, in order, and refreshes the cached journal', async () => {
      const selection = queryBuilder({
        many: [trashed({ id: 12, index: 1 }), trashed({ id: 14, index: 3 }), trashed({ id: 15, date: '2026-10-21', index: 1 })],
      });
      managerEntries.createQueryBuilder
        .mockReturnValueOnce(selection)
        .mockReturnValueOnce(queryBuilder({ raw: [{ date: '2026-10-20', count: '2' }] }));

      await expect(service.restore(7, [12, 14, 15])).resolves.toEqual({
        success: true,
        restoredCount: 3,
        movedToDefaultCount: 0,
      });

      expect(selection.andWhere).toHaveBeenCalledWith('e.id IN (:...ids)', { ids: [12, 14, 15] });
      expect(selection.setLock).toHaveBeenCalledWith('pessimistic_write');
      const updates = managerEntries.update.mock.calls.map(([criteria, values]) => [criteria.id, values.index, values.deletedAt]);
      expect(updates).toEqual([[12, 3, null], [14, 4, null], [15, 1, null]]);
      expect(cache.invalidateUser).toHaveBeenCalledWith(7);
    });

    it('sends entries of a missing diary to the default diary and drops import references taken again', async () => {
      managerEntries.createQueryBuilder
        .mockReturnValueOnce(queryBuilder({
          many: [
            trashed({ id: 12, diaryId: 99, importRef: 'dayone:a' }),
            trashed({ id: 13, diaryId: null, importRef: 'dayone:b' }),
            trashed({ id: 14, importRef: 'dayone:b' }),
          ],
        }))
        .mockReturnValueOnce(queryBuilder());
      managerEntries.find.mockResolvedValue([{ id: 30, importRef: 'dayone:a' }]);

      await expect(service.restore(7)).resolves.toEqual({ success: true, restoredCount: 3, movedToDefaultCount: 2 });

      const values = managerEntries.update.mock.calls.map(([, update]) => [update.diaryId, update.importRef]);
      expect(values).toEqual([[1, null], [1, 'dayone:b'], [2, null]]);
    });

    it('keeps restored entries pinned only while the pinned limit allows', async () => {
      managerEntries.createQueryBuilder
        .mockReturnValueOnce(queryBuilder({ many: [trashed({ id: 12, isPinned: true }), trashed({ id: 13, isPinned: true })] }))
        .mockReturnValueOnce(queryBuilder());
      managerEntries.count.mockResolvedValue(2);

      await service.restore(7);

      expect(managerEntries.update.mock.calls.map(([, update]) => update.isPinned)).toEqual([true, false]);
    });

    it('refuses when none of the entries are in the bin', async () => {
      managerEntries.createQueryBuilder.mockReturnValueOnce(queryBuilder());

      await expectApiError(service.restore(7, [40]), NotFoundException, 'RECYCLE_BIN_ENTRIES_NOT_FOUND');
      expect(managerEntries.update).not.toHaveBeenCalled();
      expect(cache.invalidateUser).not.toHaveBeenCalled();
    });
  });

  describe('deletePermanently', () => {
    it('deletes the chosen entries with their attachment rows, then their stored files', async () => {
      const selection = queryBuilder({ many: [{ id: 12 }, { id: 13 }] });
      managerEntries.createQueryBuilder.mockReturnValue(selection);
      manager.find.mockResolvedValue([{ id: 5, storedFilename: 'river.jpg' }]);

      await expect(service.deletePermanently(7, [12, 13])).resolves.toBe(2);

      expect(selection.where).toHaveBeenCalledWith('e.deleted_at IS NOT NULL');
      expect(selection.andWhere).toHaveBeenCalledWith('e.user_id = :userId', { userId: 7 });
      expect(selection.andWhere).toHaveBeenCalledWith('e.id IN (:...ids)', { ids: [12, 13] });
      expect(selection.setOnLocked).toHaveBeenCalledWith('skip_locked');
      expect(manager.delete).toHaveBeenCalledWith(Entry, { id: expect.anything() });
      expect(attachmentsService.removeStoredFiles).toHaveBeenCalledWith(['river.jpg']);
    });

    it('empties the whole bin, and refuses a selection that matches nothing', async () => {
      managerEntries.createQueryBuilder.mockReturnValue(queryBuilder());

      await expect(service.deletePermanently(7)).resolves.toBe(0);
      await expect(service.deletePermanently(7, [99])).rejects.toThrow(NotFoundException);
      expect(manager.delete).not.toHaveBeenCalled();
      expect(attachmentsService.removeStoredFiles).toHaveBeenCalledWith([]);
    });
  });

  describe('purgeExpired', () => {
    it('removes entries deleted more than 30 days ago in batches until none are left', async () => {
      const fullBatch = queryBuilder({ many: Array.from({ length: 100 }, (_, index) => ({ id: index + 1 })) });
      const lastBatch = queryBuilder({ many: [{ id: 101 }] });
      managerEntries.createQueryBuilder.mockReturnValueOnce(fullBatch).mockReturnValueOnce(lastBatch);
      const now = new Date('2026-11-30T12:00:00Z');

      await expect(service.purgeExpired(now)).resolves.toBe(101);

      expect(fullBatch.andWhere).toHaveBeenCalledWith('e.deleted_at <= :cutoff', { cutoff: new Date('2026-10-31T12:00:00Z') });
      expect(fullBatch.limit).toHaveBeenCalledWith(100);
      expect(manager.delete).toHaveBeenCalledTimes(2);
    });
  });

  it('dates the purge 30 days after the deletion', () => {
    expect(purgeDateFor(new Date('2026-10-22T08:30:00Z')).toISOString()).toBe('2026-11-21T08:30:00.000Z');
  });
});
