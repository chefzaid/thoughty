import { Test, TestingModule } from '@nestjs/testing';
import { EntriesService } from './entries.service';
import { EntriesQueryService } from './entries-query.service';
import { EntryLookupService } from './entry-lookup.service';
import { EntriesCommandService } from './entries-command.service';
import { EntryListCacheService } from './entry-list-cache.service';
import { EntryTaskListService } from './entry-task-list.service';
import { EntryCalendarService } from './entry-calendar.service';
import { EntryRandomService } from './entry-random.service';
import type { Entry } from '@/database/entities';
import { TimeCapsuleService } from '@/modules/time-capsules/time-capsules.service';

/** A saved entry as TypeORM returns it, without the relations a mutation does not load. */
const savedEntry = (fields: Partial<Entry> = {}) =>
  ({
    id: 1,
    userId: 1,
    diaryId: 2,
    date: '2024-01-16',
    index: 1,
    title: null,
    timeOfDay: null,
    mood: null,
    feelings: [],
    tags: ['work'],
    content: 'Updated content',
    format: 'plain',
    visibility: 'private',
    isFavorite: false,
    isArchived: false,
    isPinned: false,
    createdAt: new Date('2024-01-16T08:00:00Z'),
    ...fields,
  }) as Entry;

describe('EntriesService', () => {
  let service: EntriesService;
  let entriesQueryService: Record<string, jest.Mock>;
  let entryLookupService: Record<string, jest.Mock>;
  let entriesCommandService: Record<string, jest.Mock>;
  let entryListCacheService: Record<string, jest.Mock>;
  let entryTaskListService: Record<string, jest.Mock>;
  let timeCapsuleService: Record<string, jest.Mock>;
  let entryCalendarService: Record<string, jest.Mock>;
  let entryRandomService: Record<string, jest.Mock>;

  beforeEach(async () => {
    entriesQueryService = {
      getEntries: jest.fn(),
      getDates: jest.fn(),
      getHighlights: jest.fn(),
      getRevisions: jest.fn(),
    };

    entryLookupService = {
      getFirstEntry: jest.fn(),
      getEntryByDate: jest.fn(),
      getBacklinks: jest.fn(),
    };

    entriesCommandService = {
      create: jest.fn(),
      update: jest.fn(),
      updateVisibility: jest.fn(),
      toggleFavorite: jest.fn(),
      toggleArchived: jest.fn(),
      togglePinned: jest.fn(),
      deleteAll: jest.fn(),
      delete: jest.fn(),
      bulkOperation: jest.fn(),
      renameTag: jest.fn(),
      deleteTag: jest.fn(),
      reorderEntries: jest.fn(),
      deleteRevision: jest.fn(),
    };

    entryListCacheService = {
      getOrLoad: jest.fn((_userId: number, _query: unknown, load: () => Promise<unknown>) => load()),
    };

    entryTaskListService = {
      setTask: jest.fn(),
    };

    entryCalendarService = {
      getMonth: jest.fn(),
    };

    entryRandomService = {
      pick: jest.fn(),
    };

    timeCapsuleService = {
      openEarly: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntriesService,
        { provide: EntriesQueryService, useValue: entriesQueryService },
        { provide: EntryLookupService, useValue: entryLookupService },
        { provide: EntriesCommandService, useValue: entriesCommandService },
        { provide: EntryListCacheService, useValue: entryListCacheService },
        { provide: EntryTaskListService, useValue: entryTaskListService },
        { provide: EntryCalendarService, useValue: entryCalendarService },
        { provide: EntryRandomService, useValue: entryRandomService },
        { provide: TimeCapsuleService, useValue: timeCapsuleService },
      ],
    }).compile();

    service = module.get<EntriesService>(EntriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reads the list through the cache, which loads it from EntriesQueryService when stale', async () => {
    const expected = { entries: [], total: 0, page: 1, totalPages: 1, allTags: [] };
    entriesQueryService.getEntries.mockResolvedValue(expected);

    const result = await service.getEntries(1, { page: 1, limit: 10 });

    expect(entryListCacheService.getOrLoad).toHaveBeenCalledWith(1, { page: 1, limit: 10 }, expect.any(Function));
    expect(entriesQueryService.getEntries).toHaveBeenCalledWith(1, { page: 1, limit: 10 });
    expect(result).toBe(expected);
  });

  it('serves a cached list without querying the entries', async () => {
    const expected = { entries: [], total: 0, page: 1, totalPages: 1, allTags: [] };
    entryListCacheService.getOrLoad.mockResolvedValue(expected);

    await expect(service.getEntries(1, { page: 1, limit: 10 })).resolves.toBe(expected);
    expect(entriesQueryService.getEntries).not.toHaveBeenCalled();
  });

  it('delegates the random entry to EntryRandomService without the list cache', async () => {
    const expected = { id: 4, date: '2026-10-02', index: 1, page: 2 };
    entryRandomService.pick.mockResolvedValue(expected);

    await expect(service.getRandomEntry(1, { tags: 'walks', excludeId: 3 })).resolves.toBe(expected);
    expect(entryRandomService.pick).toHaveBeenCalledWith(1, { tags: 'walks', excludeId: 3 });
    expect(entryListCacheService.getOrLoad).not.toHaveBeenCalled();
  });

  it('delegates the calendar month to EntryCalendarService without the list cache', async () => {
    const expected = { month: '2026-10', entries: [] };
    entryCalendarService.getMonth.mockResolvedValue(expected);

    const result = await service.getCalendarMonth(1, { month: '2026-10', mood: 'any' });

    expect(entryCalendarService.getMonth).toHaveBeenCalledWith(1, { month: '2026-10', mood: 'any' });
    expect(entryListCacheService.getOrLoad).not.toHaveBeenCalled();
    expect(result).toBe(expected);
  });

  it('delegates getDates to EntriesQueryService', async () => {
    const expected = { dates: ['2024-01-15'] };
    entriesQueryService.getDates.mockResolvedValue(expected);

    const result = await service.getDates(1);

    expect(entriesQueryService.getDates).toHaveBeenCalledWith(1);
    expect(result).toBe(expected);
  });

  it('delegates getFirstEntry to EntryLookupService', async () => {
    const expected = { page: 1, found: true, years: [2024], months: ['2024-01'] };
    entryLookupService.getFirstEntry.mockResolvedValue(expected);

    const result = await service.getFirstEntry(1, { year: 2024, limit: 10 });

    expect(entryLookupService.getFirstEntry).toHaveBeenCalledWith(1, { year: 2024, limit: 10 });
    expect(result).toBe(expected);
  });

  it('delegates getEntryByDate to EntryLookupService', async () => {
    const expected = { found: true, entryId: 1 };
    entryLookupService.getEntryByDate.mockResolvedValue(expected);

    const result = await service.getEntryByDate(1, { date: '2024-01-15', index: 1, limit: 10 });

    expect(entryLookupService.getEntryByDate).toHaveBeenCalledWith(1, { date: '2024-01-15', index: 1, limit: 10 });
    expect(result).toEqual(expected);
  });

  it('answers the entry it found in the API shape, not as the database entity', async () => {
    entryLookupService.getEntryByDate.mockResolvedValue({ found: true, entry: savedEntry(), page: 2, entryId: 1 });

    const result = await service.getEntryByDate(1, { date: '2024-01-16', index: 1, limit: 10 });

    expect(result).toEqual({ found: true, page: 2, entryId: 1, entry: expect.objectContaining({ id: 1, diary_id: 2, is_favorite: false }) });
    expect(result.entry).not.toHaveProperty('isFavorite');
  });

  it('delegates getBacklinks to EntryLookupService', async () => {
    const expected = { backlinks: [{ id: 2 }] };
    entryLookupService.getBacklinks.mockResolvedValue(expected);

    const result = await service.getBacklinks(1, 5);

    expect(entryLookupService.getBacklinks).toHaveBeenCalledWith(1, 5);
    expect(result).toBe(expected);
  });

  it('delegates getHighlights to EntriesQueryService', async () => {
    const expected = { randomEntry: null, onThisDay: {}, currentDate: { month: '01', day: '01', year: 2024 } };
    entriesQueryService.getHighlights.mockResolvedValue(expected);

    const result = await service.getHighlights(1, {});

    expect(entriesQueryService.getHighlights).toHaveBeenCalledWith(1, {});
    expect(result).toBe(expected);
  });

  it('delegates getRevisions to EntriesQueryService', async () => {
    const expected = [{ id: 1 }];
    entriesQueryService.getRevisions.mockResolvedValue(expected);

    const result = await service.getRevisions(1, 5);

    expect(entriesQueryService.getRevisions).toHaveBeenCalledWith(1, 5);
    expect(result).toBe(expected);
  });

  it('delegates create to EntriesCommandService', async () => {
    const dto = { tags: ['tag1'], text: 'New entry content', date: '2024-01-15' };
    const expected = { success: true, entryId: 1 };
    entriesCommandService.create.mockResolvedValue(expected);

    const result = await service.create(1, dto);

    expect(entriesCommandService.create).toHaveBeenCalledWith(1, dto);
    expect(result).toBe(expected);
  });

  it('delegates update to EntriesCommandService', async () => {
    const dto = { text: 'Updated content', tags: ['work'], date: '2024-01-16' };
    const saved = { success: true, entry: savedEntry() };
    entriesCommandService.update.mockResolvedValue(saved);

    const result = await service.update(1, 1, dto as never);

    expect(entriesCommandService.update).toHaveBeenCalledWith(1, 1, dto);
    expect(result).toEqual({ success: true, entry: expect.objectContaining({ id: 1, content: 'Updated content' }) });
  });

  it('ticks a task through EntryTaskListService', async () => {
    const saved = { success: true, entry: savedEntry({ content: '- [x] Call' }) };
    entryTaskListService.setTask.mockResolvedValue(saved);

    const result = await service.setTask(1, 4, { line: 0, checked: true });

    expect(entryTaskListService.setTask).toHaveBeenCalledWith(1, 4, { line: 0, checked: true });
    expect(result).toEqual({ success: true, entry: expect.objectContaining({ id: 1, content: '- [x] Call' }) });
  });

  it('delegates updateVisibility to EntriesCommandService', async () => {
    const saved = { success: true, entry: savedEntry({ visibility: 'public' }) };
    entriesCommandService.updateVisibility.mockResolvedValue(saved);

    const result = await service.updateVisibility(1, 1, 'public');

    expect(entriesCommandService.updateVisibility).toHaveBeenCalledWith(1, 1, 'public');
    expect(result).toEqual({ success: true, entry: expect.objectContaining({ id: 1, visibility: 'public' }) });
  });

  it('delegates toggleFavorite to EntriesCommandService', async () => {
    const saved = { success: true, entry: savedEntry({ isFavorite: true }) };
    entriesCommandService.toggleFavorite.mockResolvedValue(saved);

    const result = await service.toggleFavorite(1, 1, true);

    expect(entriesCommandService.toggleFavorite).toHaveBeenCalledWith(1, 1, true);
    expect(result).toEqual({ success: true, entry: expect.objectContaining({ id: 1, is_favorite: true }) });
  });

  it('delegates toggleArchived to EntriesCommandService', async () => {
    const saved = { success: true, entry: savedEntry({ isArchived: true }) };
    entriesCommandService.toggleArchived.mockResolvedValue(saved);

    const result = await service.toggleArchived(1, 1, true);

    expect(entriesCommandService.toggleArchived).toHaveBeenCalledWith(1, 1, true);
    expect(result).toEqual({ success: true, entry: expect.objectContaining({ id: 1, is_archived: true }) });
  });

  it('delegates togglePinned to EntriesCommandService', async () => {
    const saved = { success: true, entry: savedEntry({ isPinned: true }) };
    entriesCommandService.togglePinned.mockResolvedValue(saved);

    const result = await service.togglePinned(1, 1, true);

    expect(entriesCommandService.togglePinned).toHaveBeenCalledWith(1, 1, true);
    expect(result).toEqual({ success: true, entry: expect.objectContaining({ id: 1, is_pinned: true }) });
  });

  it('opens a sealed time capsule early', async () => {
    timeCapsuleService.openEarly.mockResolvedValue(savedEntry({ content: 'Dear future me' }));

    const result = await service.unseal(1, 1);

    expect(timeCapsuleService.openEarly).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual({ success: true, entry: expect.objectContaining({ id: 1, content: 'Dear future me', sealed_until: null }) });
  });

  it('delegates deleteAll to EntriesCommandService', async () => {
    const expected = { success: true, deletedCount: 10 };
    entriesCommandService.deleteAll.mockResolvedValue(expected);

    const result = await service.deleteAll(1, 3);

    expect(entriesCommandService.deleteAll).toHaveBeenCalledWith(1, 3);
    expect(result).toBe(expected);
  });

  it('delegates delete to EntriesCommandService', async () => {
    const expected = { success: true };
    entriesCommandService.delete.mockResolvedValue(expected);

    const result = await service.delete(1, 9);

    expect(entriesCommandService.delete).toHaveBeenCalledWith(1, 9);
    expect(result).toBe(expected);
  });

  it('delegates bulkOperation to EntriesCommandService', async () => {
    const dto = { ids: [1, 2], action: 'delete' as const };
    const expected = { success: true, affectedCount: 2 };
    entriesCommandService.bulkOperation.mockResolvedValue(expected);

    const result = await service.bulkOperation(1, dto);

    expect(entriesCommandService.bulkOperation).toHaveBeenCalledWith(1, dto);
    expect(result).toBe(expected);
  });

  it('delegates renameTag to EntriesCommandService', async () => {
    const expected = { success: true, affectedCount: 4 };
    entriesCommandService.renameTag.mockResolvedValue(expected);

    const result = await service.renameTag(1, 'old', 'new');

    expect(entriesCommandService.renameTag).toHaveBeenCalledWith(1, 'old', 'new');
    expect(result).toBe(expected);
  });

  it('deletes tags through EntriesCommandService', async () => {
    const expected = { success: true, affectedCount: 2 };
    entriesCommandService.deleteTag.mockResolvedValue(expected);

    const result = await service.deleteTag(1, 'old');

    expect(entriesCommandService.deleteTag).toHaveBeenCalledWith(1, 'old');
    expect(result).toBe(expected);
  });

  it('delegates reorderEntries to EntriesCommandService', async () => {
    const expected = { success: true };
    entriesCommandService.reorderEntries.mockResolvedValue(expected);

    const result = await service.reorderEntries(1, '2024-01-15', [2, 1]);

    expect(entriesCommandService.reorderEntries).toHaveBeenCalledWith(1, '2024-01-15', [2, 1]);
    expect(result).toBe(expected);
  });

  it('delegates deleteRevision to EntriesCommandService', async () => {
    const expected = { success: true };
    entriesCommandService.deleteRevision.mockResolvedValue(expected);

    const result = await service.deleteRevision(1, 2, 3);

    expect(entriesCommandService.deleteRevision).toHaveBeenCalledWith(1, 2, 3);
    expect(result).toBe(expected);
  });
});
