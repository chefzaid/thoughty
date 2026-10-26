import { IoService } from './io.service';
import { createIoServiceTestBed, mockDiary, mockEntry } from './io.test-helpers';

describe('IoService', () => {
  let service: IoService;
  let entryRepository: any;
  let settingRepository: any;
  let diaryRepository: any;

  beforeEach(async () => {
    ({ service, entryRepository, settingRepository, diaryRepository } = await createIoServiceTestBed());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('export', () => {
    it('should export entries as text file', async () => {
      settingRepository.find.mockResolvedValue([]);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockEntry]);

      const result = await service.export(1);

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('filename');
      expect(result.filename).toContain('thoughty_');
      expect(result.filename).toContain('all_diaries_');
    });

    it('should filter by diaryId when provided', async () => {
      settingRepository.find.mockResolvedValue([]);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockEntry]);

      diaryRepository.findOne.mockResolvedValue(mockDiary);
      const result = await service.export(1, 1);

      expect(result.filename).toContain('Test_Diary_');
      expect(mockQb.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 1 });
    });

    it('should handle empty entries', async () => {
      settingRepository.find.mockResolvedValue([]);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);

      const result = await service.export(1);

      expect(result.content).toBe('');
    });

    it('should include visibility when includeVisibility is true', async () => {
      settingRepository.find.mockResolvedValue([]);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockEntry]);

      const result = await service.export(1, undefined, true);

      expect(result.content).toContain('[private]');
    });

    it('should not include visibility by default', async () => {
      settingRepository.find.mockResolvedValue([]);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockEntry]);

      const result = await service.export(1);

      expect(result.content).not.toContain('[private]');
      expect(result.content).not.toContain('[public]');
    });

    it('should use diary name in filename when diary exists', async () => {
      settingRepository.find.mockResolvedValue([]);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockEntry]);
      diaryRepository.findOne.mockResolvedValue({ ...mockDiary, name: 'My Journal' });

      const result = await service.export(1, 1);

      expect(result.filename).toContain('My_Journal_');
    });

    it('should fallback to diaryId label when diary not found', async () => {
      settingRepository.find.mockResolvedValue([]);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockEntry]);
      diaryRepository.findOne.mockResolvedValue(null);

      const result = await service.export(1, 99);

      expect(result.filename).toContain('diary99_');
    });

    it('should export as JSON format', async () => {
      settingRepository.find.mockResolvedValue([]);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockEntry]);

      const result = await service.export(1, undefined, false, 'json');

      expect(result.filename).toContain('.json');
      expect(result.contentType).toBe('application/json; charset=utf-8');
      const parsed = JSON.parse(String(result.content));
      expect(parsed.entries).toHaveLength(1);
    });

    it('should export as Markdown format', async () => {
      settingRepository.find.mockResolvedValue([]);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockEntry]);

      const result = await service.export(1, undefined, false, 'md');

      expect(result.filename).toContain('.md');
      expect(result.contentType).toBe('text/markdown; charset=utf-8');
      expect(result.content).toContain('# 2024-01-15');
    });

    it('should export as CSV format with entry metrics', async () => {
      settingRepository.find.mockResolvedValue([]);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockEntry]);

      const result = await service.export(1, undefined, true, 'csv');

      expect(result.filename).toContain('.csv');
      expect(result.contentType).toBe('text/csv; charset=utf-8');
      expect(result.content).toContain('word_count,reading_time_minutes');
      expect(result.content).toContain('private,plain,3,1,Test entry content');
    });

    it('should default to txt format', async () => {
      settingRepository.find.mockResolvedValue([]);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockEntry]);

      const result = await service.export(1);

      expect(result.filename).toContain('.txt');
      expect(result.contentType).toBe('text/plain; charset=utf-8');
    });

    it('should export as a PDF document', async () => {
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockEntry]);

      const result = await service.export(1, undefined, false, 'pdf');

      expect(result.filename).toContain('.pdf');
      expect(result.contentType).toBe('application/pdf');
      expect(Buffer.isBuffer(result.content)).toBe(true);
      expect((result.content as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('should export as an HTML document grouped by month', async () => {
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockEntry]);

      const result = await service.export(1, undefined, false, 'html');

      expect(result.filename).toContain('.html');
      expect(result.contentType).toBe('text/html; charset=utf-8');
      expect(result.content).toContain('<!DOCTYPE html>');
      expect(result.content).toContain('January 2024');
      expect(result.content).toContain('Test entry content');
    });

    it('should export as an EPUB document', async () => {
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockEntry]);

      const result = await service.export(1, undefined, false, 'epub');

      expect(result.filename).toContain('.epub');
      expect(result.contentType).toBe('application/epub+zip');
      expect(Buffer.isBuffer(result.content)).toBe(true);
      expect((result.content as Buffer).subarray(0, 2).toString()).toBe('PK');
    });

    it('should title document exports with the diary name and username author', async () => {
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockEntry]);
      diaryRepository.findOne.mockResolvedValue(mockDiary);

      const result = await service.export(1, 1, false, 'html');

      expect(result.content).toContain('Test Diary');
      expect(result.content).toContain('by jane');
    });

    it('should include diary names when exporting all diaries as JSON', async () => {
      settingRepository.find.mockResolvedValue([]);
      diaryRepository.find.mockResolvedValue([
        { id: 1, name: 'Work' },
        { id: 2, name: 'Personal' },
      ]);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([
        { ...mockEntry, diaryId: 1 },
        { ...mockEntry, id: 2, diaryId: 2, content: 'Second entry' },
      ]);

      const result = await service.export(1, undefined, false, 'json');

      expect(result.content).toContain('"diary": "Work"');
      expect(result.content).toContain('"diary": "Personal"');
    });
  });
});
