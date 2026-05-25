import { Test, TestingModule } from '@nestjs/testing';
import { EntriesController } from './entries.controller';
import { EntriesService } from './entries.service';

describe('EntriesController', () => {
  let controller: EntriesController;
  let entriesService: any;

  const mockUser = { userId: 1, email: 'test@example.com' };

  beforeEach(async () => {
    entriesService = {
      getEntries: jest.fn(),
      getDates: jest.fn(),
      getFirstEntry: jest.fn(),
      getEntryByDate: jest.fn(),
      getHighlights: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateVisibility: jest.fn(),
      deleteAll: jest.fn(),
      delete: jest.fn(),
      bulkOperation: jest.fn(),
      toggleFavorite: jest.fn(),
      toggleArchived: jest.fn(),
      getRevisions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EntriesController],
      providers: [{ provide: EntriesService, useValue: entriesService }],
    }).compile();

    controller = module.get<EntriesController>(EntriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getEntries', () => {
    it('delegates to entriesService.getEntries', async () => {
      const query = { page: 1, limit: 10 } as any;
      const expected = { entries: [], total: 0 };
      entriesService.getEntries!.mockResolvedValue(expected as any);

      const result = await controller.getEntries(mockUser as any, query);
      expect(entriesService.getEntries).toHaveBeenCalledWith(1, query);
      expect(result).toBe(expected);
    });
  });

  describe('getDates', () => {
    it('delegates to entriesService.getDates', async () => {
      const expected = { dates: ['2024-01-15'] };
      entriesService.getDates!.mockResolvedValue(expected);

      const result = await controller.getDates(mockUser as any);
      expect(entriesService.getDates).toHaveBeenCalledWith(1);
      expect(result).toBe(expected);
    });
  });

  describe('getFirstEntry', () => {
    it('delegates to entriesService.getFirstEntry', async () => {
      const query = { year: 2024, month: 1 } as any;
      const expected = { page: 1 };
      entriesService.getFirstEntry!.mockResolvedValue(expected);

      const result = await controller.getFirstEntry(mockUser as any, query);
      expect(entriesService.getFirstEntry).toHaveBeenCalledWith(1, query);
      expect(result).toBe(expected);
    });
  });

  describe('getEntryByDate', () => {
    it('delegates to entriesService.getEntryByDate', async () => {
      const query = { date: '2024-01-15' } as any;
      const expected = { id: 1, content: 'entry' };
      entriesService.getEntryByDate!.mockResolvedValue(expected);

      const result = await controller.getEntryByDate(mockUser as any, query);
      expect(entriesService.getEntryByDate).toHaveBeenCalledWith(1, query);
      expect(result).toBe(expected);
    });

    it('delegates permalink lookups by entry id to entriesService.getEntryByDate', async () => {
      const query = { id: 42, limit: 10 } as any;
      const expected = { found: true, page: 3, entryId: 42 };
      entriesService.getEntryByDate!.mockResolvedValue(expected);

      const result = await controller.getEntryByDate(mockUser as any, query);
      expect(entriesService.getEntryByDate).toHaveBeenCalledWith(1, query);
      expect(result).toBe(expected);
    });
  });

  describe('getHighlights', () => {
    it('delegates to entriesService.getHighlights', async () => {
      const query = { diaryId: 1 } as any;
      const expected = { randomEntry: null, onThisDay: [] };
      entriesService.getHighlights!.mockResolvedValue(expected);

      const result = await controller.getHighlights(mockUser as any, query);
      expect(entriesService.getHighlights).toHaveBeenCalledWith(1, query);
      expect(result).toBe(expected);
    });
  });

  describe('create', () => {
    it('delegates to entriesService.create', async () => {
      const dto = { text: 'New entry', tags: ['tag1'] } as any;
      const expected = { success: true };
      entriesService.create!.mockResolvedValue(expected);

      const result = await controller.create(mockUser as any, dto);
      expect(entriesService.create).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(expected);
    });
  });

  describe('update', () => {
    it('delegates to entriesService.update', async () => {
      const dto = { text: 'Updated', tags: [], date: '2024-01-15' } as any;
      const expected = { success: true };
      entriesService.update!.mockResolvedValue(expected);

      const result = await controller.update(mockUser as any, 5, dto);
      expect(entriesService.update).toHaveBeenCalledWith(1, 5, dto);
      expect(result).toBe(expected);
    });
  });

  describe('updateVisibility', () => {
    it('delegates to entriesService.updateVisibility', async () => {
      const dto = { visibility: 'public' as const };
      const expected = { success: true };
      entriesService.updateVisibility!.mockResolvedValue(expected);

      const result = await controller.updateVisibility(mockUser as any, 5, dto);
      expect(entriesService.updateVisibility).toHaveBeenCalledWith(1, 5, 'public');
      expect(result).toBe(expected);
    });
  });

  describe('deleteAll', () => {
    it('delegates to entriesService.deleteAll with diaryId', async () => {
      const query = { diaryId: 2 } as any;
      const expected = { success: true, deletedCount: 10 };
      entriesService.deleteAll!.mockResolvedValue(expected);

      const result = await controller.deleteAll(mockUser as any, query);
      expect(entriesService.deleteAll).toHaveBeenCalledWith(1, 2);
      expect(result).toBe(expected);
    });
  });

  describe('delete', () => {
    it('delegates to entriesService.delete', async () => {
      const expected = { success: true };
      entriesService.delete!.mockResolvedValue(expected);

      const result = await controller.delete(mockUser as any, 7);
      expect(entriesService.delete).toHaveBeenCalledWith(1, 7);
      expect(result).toBe(expected);
    });
  });

  describe('bulkOperation', () => {
    it('delegates to entriesService.bulkOperation', async () => {
      const dto = { ids: [1, 2, 3], action: 'delete' as const };
      const expected = { success: true, affectedCount: 3 };
      entriesService.bulkOperation!.mockResolvedValue(expected);

      const result = await controller.bulkOperation(mockUser as any, dto as any);
      expect(entriesService.bulkOperation).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(expected);
    });

    it('delegates bulk visibility operation', async () => {
      const dto = { ids: [1], action: 'visibility' as const, visibility: 'public' as const };
      const expected = { success: true, affectedCount: 1 };
      entriesService.bulkOperation!.mockResolvedValue(expected);

      const result = await controller.bulkOperation(mockUser as any, dto as any);
      expect(entriesService.bulkOperation).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(expected);
    });

    it('delegates bulk move operation', async () => {
      const dto = { ids: [1, 2], action: 'move' as const, diaryId: 5 };
      const expected = { success: true, affectedCount: 2 };
      entriesService.bulkOperation!.mockResolvedValue(expected);

      const result = await controller.bulkOperation(mockUser as any, dto as any);
      expect(entriesService.bulkOperation).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(expected);
    });
  });

  describe('toggleFavorite', () => {
    it('delegates to entriesService.toggleFavorite', async () => {
      const dto = { isFavorite: true };
      const expected = { success: true, entry: { id: 1, isFavorite: true } };
      entriesService.toggleFavorite!.mockResolvedValue(expected);

      const result = await controller.toggleFavorite(mockUser as any, 1, dto as any);
      expect(entriesService.toggleFavorite).toHaveBeenCalledWith(1, 1, true);
      expect(result).toBe(expected);
    });

    it('delegates unfavorite to entriesService.toggleFavorite', async () => {
      const dto = { isFavorite: false };
      const expected = { success: true, entry: { id: 1, isFavorite: false } };
      entriesService.toggleFavorite!.mockResolvedValue(expected);

      const result = await controller.toggleFavorite(mockUser as any, 1, dto as any);
      expect(entriesService.toggleFavorite).toHaveBeenCalledWith(1, 1, false);
      expect(result).toBe(expected);
    });
  });

  describe('toggleArchived', () => {
    it('delegates to entriesService.toggleArchived', async () => {
      const dto = { isArchived: true };
      const expected = { success: true, entry: { id: 1, isArchived: true } };
      entriesService.toggleArchived!.mockResolvedValue(expected);

      const result = await controller.toggleArchived(mockUser as any, 1, dto as any);
      expect(entriesService.toggleArchived).toHaveBeenCalledWith(1, 1, true);
      expect(result).toBe(expected);
    });

    it('delegates unarchive to entriesService.toggleArchived', async () => {
      const dto = { isArchived: false };
      const expected = { success: true, entry: { id: 1, isArchived: false } };
      entriesService.toggleArchived!.mockResolvedValue(expected);

      const result = await controller.toggleArchived(mockUser as any, 1, dto as any);
      expect(entriesService.toggleArchived).toHaveBeenCalledWith(1, 1, false);
      expect(result).toBe(expected);
    });
  });

  describe('getHistory', () => {
    it('delegates to entriesService.getRevisions', async () => {
      const expected = [{ id: 1, content: 'Old content', createdAt: new Date() }];
      entriesService.getRevisions!.mockResolvedValue(expected);

      const result = await controller.getHistory(mockUser as any, 1);
      expect(entriesService.getRevisions).toHaveBeenCalledWith(1, 1);
      expect(result).toBe(expected);
    });
  });
});
