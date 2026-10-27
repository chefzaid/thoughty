import { Test, TestingModule } from '@nestjs/testing';
import { EntriesService } from './entries.service';
import { EntriesQueryService } from './entries-query.service';
import { EntryLookupService } from './entry-lookup.service';
import { EntriesCommandService } from './entries-command.service';
import { EntryListCacheService } from './entry-list-cache.service';
import { EntryTaskListService } from './entry-task-list.service';
import { EntryCalendarService } from './entry-calendar.service';

describe('EntriesService', () => {
  let service: EntriesService;
  let entriesQueryService: Record<string, jest.Mock>;
  let entryLookupService: Record<string, jest.Mock>;
  let entriesCommandService: Record<string, jest.Mock>;
  let entryListCacheService: Record<string, jest.Mock>;
  let entryTaskListService: Record<string, jest.Mock>;
  let entryCalendarService: Record<string, jest.Mock>;

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
      get: jest.fn(),
      set: jest.fn(),
      invalidateUser: jest.fn(),
    };

    entryTaskListService = {
      setTask: jest.fn(),
    };

    entryCalendarService = {
      getMonth: jest.fn(),
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
      ],
    }).compile();

    service = module.get<EntriesService>(EntriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns cached entries without querying the database', async () => {
    const expected = { entries: [], total: 0, page: 1, totalPages: 1, allTags: [] };
    entryListCacheService.get.mockReturnValue(expected);

    const result = await service.getEntries(1, { page: 1, limit: 10 });

    expect(entryListCacheService.get).toHaveBeenCalledWith(1, { page: 1, limit: 10 });
    expect(entriesQueryService.getEntries).not.toHaveBeenCalled();
    expect(result).toBe(expected);
  });

  it('delegates getEntries to EntriesQueryService and caches misses', async () => {
    const expected = { entries: [], total: 0, page: 1, totalPages: 1, allTags: [] };
    entryListCacheService.get.mockReturnValue(undefined);
    entriesQueryService.getEntries.mockResolvedValue(expected);

    const result = await service.getEntries(1, { page: 1, limit: 10 });

    expect(entriesQueryService.getEntries).toHaveBeenCalledWith(1, { page: 1, limit: 10 });
    expect(entryListCacheService.set).toHaveBeenCalledWith(1, { page: 1, limit: 10 }, expected);
    expect(result).toBe(expected);
  });

  it('delegates the calendar month to EntryCalendarService without the list cache', async () => {
    const expected = { month: '2026-10', entries: [] };
    entryCalendarService.getMonth.mockResolvedValue(expected);

    const result = await service.getCalendarMonth(1, { month: '2026-10', mood: 'any' });

    expect(entryCalendarService.getMonth).toHaveBeenCalledWith(1, { month: '2026-10', mood: 'any' });
    expect(entryListCacheService.get).not.toHaveBeenCalled();
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
    expect(result).toBe(expected);
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
    expect(entryListCacheService.invalidateUser).toHaveBeenCalledWith(1);
    expect(result).toBe(expected);
  });

  it('delegates update to EntriesCommandService', async () => {
    const dto = { text: 'Updated content', tags: ['work'], date: '2024-01-16' };
    const expected = { success: true, entry: { id: 1 } };
    entriesCommandService.update.mockResolvedValue(expected);

    const result = await service.update(1, 1, dto as never);

    expect(entriesCommandService.update).toHaveBeenCalledWith(1, 1, dto);
    expect(entryListCacheService.invalidateUser).toHaveBeenCalledWith(1);
    expect(result).toBe(expected);
  });

  it('ticks a task through EntryTaskListService and clears the cached lists', async () => {
    const expected = { success: true, entry: { id: 1, content: '- [x] Call' } };
    entryTaskListService.setTask.mockResolvedValue(expected);

    const result = await service.setTask(1, 4, { line: 0, checked: true });

    expect(entryTaskListService.setTask).toHaveBeenCalledWith(1, 4, { line: 0, checked: true });
    expect(entryListCacheService.invalidateUser).toHaveBeenCalledWith(1);
    expect(result).toBe(expected);
  });

  it('delegates updateVisibility to EntriesCommandService', async () => {
    const expected = { success: true, entry: { id: 1, visibility: 'public' } };
    entriesCommandService.updateVisibility.mockResolvedValue(expected);

    const result = await service.updateVisibility(1, 1, 'public');

    expect(entriesCommandService.updateVisibility).toHaveBeenCalledWith(1, 1, 'public');
    expect(result).toBe(expected);
  });

  it('delegates toggleFavorite to EntriesCommandService', async () => {
    const expected = { success: true, entry: { id: 1, isFavorite: true } };
    entriesCommandService.toggleFavorite.mockResolvedValue(expected);

    const result = await service.toggleFavorite(1, 1, true);

    expect(entriesCommandService.toggleFavorite).toHaveBeenCalledWith(1, 1, true);
    expect(result).toBe(expected);
  });

  it('delegates toggleArchived to EntriesCommandService', async () => {
    const expected = { success: true, entry: { id: 1, isArchived: true } };
    entriesCommandService.toggleArchived.mockResolvedValue(expected);

    const result = await service.toggleArchived(1, 1, true);

    expect(entriesCommandService.toggleArchived).toHaveBeenCalledWith(1, 1, true);
    expect(result).toBe(expected);
  });

  it('delegates togglePinned to EntriesCommandService', async () => {
    const expected = { success: true, entry: { id: 1, isPinned: true } };
    entriesCommandService.togglePinned.mockResolvedValue(expected);

    const result = await service.togglePinned(1, 1, true);

    expect(entriesCommandService.togglePinned).toHaveBeenCalledWith(1, 1, true);
    expect(result).toBe(expected);
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

  it('deletes tags through EntriesCommandService and invalidates cached lists', async () => {
    const expected = { success: true, affectedCount: 2 };
    entriesCommandService.deleteTag.mockResolvedValue(expected);

    const result = await service.deleteTag(1, 'old');

    expect(entriesCommandService.deleteTag).toHaveBeenCalledWith(1, 'old');
    expect(entryListCacheService.invalidateUser).toHaveBeenCalledWith(1);
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
