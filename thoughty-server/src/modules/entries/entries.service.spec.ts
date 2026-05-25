import { Test, TestingModule } from '@nestjs/testing';
import { EntriesService } from './entries.service';
import { EntriesQueryService } from './entries-query.service';
import { EntriesCommandService } from './entries-command.service';

describe('EntriesService', () => {
  let service: EntriesService;
  let entriesQueryService: Record<string, jest.Mock>;
  let entriesCommandService: Record<string, jest.Mock>;

  beforeEach(async () => {
    entriesQueryService = {
      getEntries: jest.fn(),
      getDates: jest.fn(),
      getFirstEntry: jest.fn(),
      getEntryByDate: jest.fn(),
      getHighlights: jest.fn(),
      getRevisions: jest.fn(),
    };

    entriesCommandService = {
      create: jest.fn(),
      update: jest.fn(),
      updateVisibility: jest.fn(),
      toggleFavorite: jest.fn(),
      toggleArchived: jest.fn(),
      deleteAll: jest.fn(),
      delete: jest.fn(),
      bulkOperation: jest.fn(),
      renameTag: jest.fn(),
      reorderEntries: jest.fn(),
      deleteRevision: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntriesService,
        { provide: EntriesQueryService, useValue: entriesQueryService },
        { provide: EntriesCommandService, useValue: entriesCommandService },
      ],
    }).compile();

    service = module.get<EntriesService>(EntriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('delegates getEntries to EntriesQueryService', async () => {
    const expected = { entries: [], total: 0, page: 1, totalPages: 1, allTags: [] };
    entriesQueryService.getEntries.mockResolvedValue(expected);

    const result = await service.getEntries(1, { page: 1, limit: 10 });

    expect(entriesQueryService.getEntries).toHaveBeenCalledWith(1, { page: 1, limit: 10 });
    expect(result).toBe(expected);
  });

  it('delegates getDates to EntriesQueryService', async () => {
    const expected = { dates: ['2024-01-15'] };
    entriesQueryService.getDates.mockResolvedValue(expected);

    const result = await service.getDates(1);

    expect(entriesQueryService.getDates).toHaveBeenCalledWith(1);
    expect(result).toBe(expected);
  });

  it('delegates getFirstEntry to EntriesQueryService', async () => {
    const expected = { page: 1, found: true, years: [2024], months: ['2024-01'] };
    entriesQueryService.getFirstEntry.mockResolvedValue(expected);

    const result = await service.getFirstEntry(1, { year: 2024, limit: 10 });

    expect(entriesQueryService.getFirstEntry).toHaveBeenCalledWith(1, { year: 2024, limit: 10 });
    expect(result).toBe(expected);
  });

  it('delegates getEntryByDate to EntriesQueryService', async () => {
    const expected = { found: true, entryId: 1 };
    entriesQueryService.getEntryByDate.mockResolvedValue(expected);

    const result = await service.getEntryByDate(1, { date: '2024-01-15', index: 1, limit: 10 });

    expect(entriesQueryService.getEntryByDate).toHaveBeenCalledWith(1, { date: '2024-01-15', index: 1, limit: 10 });
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
    const expected = { success: true, entry: { id: 1 } };
    entriesCommandService.update.mockResolvedValue(expected);

    const result = await service.update(1, 1, dto as never);

    expect(entriesCommandService.update).toHaveBeenCalledWith(1, 1, dto);
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