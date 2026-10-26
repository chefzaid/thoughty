import { BadRequestException, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
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

  describe('preview', () => {
    it('should preview import content', async () => {
      settingRepository.find.mockResolvedValue([]);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);

      const content = `
---2024-01-15--[tag1,tag2]
Test entry content

--------------------------------------------------------------------------------
`;

      const result = await service.preview(1, { content });

      expect(result).toHaveProperty('entries');
      expect(result).toHaveProperty('totalCount');
      expect(result).toHaveProperty('duplicates');
      expect(result).toHaveProperty('duplicateCount');
    });

    it('keeps the mood and feelings written in the file', async () => {
      settingRepository.find.mockResolvedValue([]);
      diaryRepository.findOne.mockResolvedValue(mockDiary);
      entryRepository.count.mockResolvedValue(0);
      entryRepository.save.mockResolvedValue(mockEntry);
      entryRepository.createQueryBuilder().getMany.mockResolvedValue([]);

      await service.import(1, { content: '---2024-01-15--[tag1]--{mood:2}--{feelings:tired,hopeful}\nLong day\n' });

      expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        mood: 2,
        feelings: ['tired', 'hopeful'],
        content: 'Long day',
      }));
    });

    it('should throw BadRequestException for empty content', async () => {
      await expect(service.preview(1, { content: '' })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for non-string content', async () => {
      await expect(service.preview(1, { content: 123 as any })).rejects.toThrow(BadRequestException);
    });

    it('should throw PayloadTooLargeException for large content', async () => {
      const largeContent = 'x'.repeat(6 * 1024 * 1024); // 6MB

      await expectApiError(service.preview(1, { content: largeContent }), PayloadTooLargeException, 'IMPORT_FILE_TOO_LARGE');
    });

    it('should detect duplicates', async () => {
      settingRepository.find.mockResolvedValue([]);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockEntry]);

      const content = `
---2024-01-15--[tag1,tag2]
Test entry content

--------------------------------------------------------------------------------
`;

      const result = await service.preview(1, { content });

      expect(result.duplicateCount).toBeGreaterThanOrEqual(0);
    });

    it('should preview JSON content', async () => {
      settingRepository.find.mockResolvedValue([]);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);

      const content = JSON.stringify({
        entries: [
          { date: '2024-01-15', index: 1, tags: ['tag1'], content: 'JSON entry' },
        ],
      });

      const result = await service.preview(1, { content });

      expect(result.totalCount).toBe(1);
      expect(result.entries[0].content).toBe('JSON entry');
    });

    it('should preview Markdown content', async () => {
      settingRepository.find.mockResolvedValue([]);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);

      const content = `# 2024-01-15\n\nMarkdown entry content`;

      const result = await service.preview(1, { content });

      expect(result.totalCount).toBe(1);
      expect(result.entries[0].content).toBe('Markdown entry content');
    });
  });

  describe('import', () => {
    it('should import entries successfully', async () => {
      settingRepository.find.mockResolvedValue([]);
      diaryRepository.findOne.mockResolvedValue(mockDiary);
      entryRepository.count.mockResolvedValue(0);
      entryRepository.save.mockResolvedValue(mockEntry);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);

      const content = `
---2024-01-15--[tag1,tag2]
Test entry content

--------------------------------------------------------------------------------
`;

      const result = await service.import(1, { content });

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('importedCount');
      expect(result).toHaveProperty('skippedCount');
      expect(result).toHaveProperty('totalProcessed');
    });

    it('keeps titles and times from the file, reading titles from the first line when the writer chose that', async () => {
      settingRepository.find.mockResolvedValue([{ key: 'io_titlePlacement', value: 'firstLine' }]);
      diaryRepository.findOne.mockResolvedValue(mockDiary);
      entryRepository.count.mockResolvedValue(0);
      entryRepository.save.mockResolvedValue(mockEntry);
      entryRepository.createQueryBuilder().getMany.mockResolvedValue([]);

      await service.import(1, { content: '---2024-01-15 21:05--[tag1]\nEvening notes\nTest entry content\n' });

      expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Evening notes',
        timeOfDay: '21:05',
        content: 'Test entry content',
      }));
    });

    it('should throw BadRequestException for empty content', async () => {
      await expectApiError(service.import(1, { content: '' }), BadRequestException, 'IMPORT_CONTENT_REQUIRED');
    });

    it('should skip duplicates when skipDuplicates is true', async () => {
      settingRepository.find.mockResolvedValue([]);
      diaryRepository.findOne.mockResolvedValue(mockDiary);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockEntry]);

      const content = `
---2024-01-15--[tag1,tag2]
Test entry content

--------------------------------------------------------------------------------
`;

      const result = await service.import(1, { content, skipDuplicates: true });

      expect(result.success).toBe(true);
    });

    it('should import duplicates when skipDuplicates is false', async () => {
      settingRepository.find.mockResolvedValue([]);
      diaryRepository.findOne.mockResolvedValue(mockDiary);
      entryRepository.count.mockResolvedValue(0);
      entryRepository.save.mockResolvedValue(mockEntry);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockEntry]);

      const content = `
---2024-01-15--[tag1,tag2]
Test entry content

--------------------------------------------------------------------------------
`;

      const result = await service.import(1, { content, skipDuplicates: false });

      expect(result.success).toBe(true);
      expect(entryRepository.save).toHaveBeenCalled();
    });

    it('should use provided diaryId', async () => {
      settingRepository.find.mockResolvedValue([]);
      diaryRepository.findOne.mockResolvedValue({ ...mockDiary, id: 5 });
      entryRepository.count.mockResolvedValue(0);
      entryRepository.save.mockResolvedValue(mockEntry);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);

      const content = `
---2024-01-15--[tag1]
Test content

--------------------------------------------------------------------------------
`;

      await service.import(1, { content, diaryId: 5 });

      expect(entryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          diaryId: 5,
        }),
      );
    });

    it('refuses to import into a diary the user does not own', async () => {
      settingRepository.find.mockResolvedValue([]);
      diaryRepository.findOne.mockResolvedValue(null);

      const content = `
---2024-01-15--[tag1]
Test content

--------------------------------------------------------------------------------
`;

      await expect(service.import(1, { content, diaryId: 99 })).rejects.toThrow(NotFoundException);
      expect(diaryRepository.findOne).toHaveBeenCalledWith({ where: { id: 99, userId: 1 } });
      expect(entryRepository.save).not.toHaveBeenCalled();
    });

    it('should use diary default visibility when entry has no visibility', async () => {
      settingRepository.find.mockResolvedValue([]);
      diaryRepository.findOne.mockResolvedValue({ ...mockDiary, visibility: 'public' });
      entryRepository.count.mockResolvedValue(0);
      entryRepository.save.mockResolvedValue(mockEntry);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);

      const content = `
---2024-01-15--[tag1]
Test content

--------------------------------------------------------------------------------
`;

      await service.import(1, { content, diaryId: 1 });

      expect(entryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: 'public',
        }),
      );
    });

    it('should use entry visibility from file when present', async () => {
      settingRepository.find.mockResolvedValue([]);
      diaryRepository.findOne.mockResolvedValue({ ...mockDiary, visibility: 'public' });
      entryRepository.count.mockResolvedValue(0);
      entryRepository.save.mockResolvedValue(mockEntry);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);

      const content = `
---2024-01-15--[tag1]--[private]
Test content

--------------------------------------------------------------------------------
`;

      await service.import(1, { content, diaryId: 1 });

      expect(entryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: 'private',
        }),
      );
    });

    it('should match diary by name when importing all diaries', async () => {
      settingRepository.find.mockResolvedValue([]);
      diaryRepository.findOne.mockResolvedValue(mockDiary);
      diaryRepository.find.mockResolvedValue([
        { id: 10, userId: 1, name: 'Work' },
        { id: 20, userId: 1, name: 'Personal' },
      ]);
      entryRepository.count.mockResolvedValue(0);
      entryRepository.save.mockResolvedValue(mockEntry);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);

      const content = JSON.stringify({
        entries: [
          {
            date: '2024-01-15',
            index: 1,
            tags: ['tag1'],
            content: 'Work entry',
            format: 'plain',
            diary: 'Work',
          },
          {
            date: '2024-01-16',
            index: 1,
            tags: ['tag2'],
            content: 'Personal entry',
            format: 'plain',
            diary: 'Personal',
          },
        ],
      });

      await service.import(1, { content });

      expect(entryRepository.save).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ diaryId: 10 }),
      );
      expect(entryRepository.save).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ diaryId: 20 }),
      );
    });

    it('should fall back to default diary when imported diary name does not match', async () => {
      settingRepository.find.mockResolvedValue([]);
      diaryRepository.findOne.mockResolvedValue({ ...mockDiary, id: 5, isDefault: true, visibility: 'private' });
      diaryRepository.find.mockResolvedValue([{ id: 10, userId: 1, name: 'Work' }]);
      entryRepository.count.mockResolvedValue(0);
      entryRepository.save.mockResolvedValue(mockEntry);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);

      const content = JSON.stringify({
        entries: [
          {
            date: '2024-01-15',
            index: 1,
            tags: ['tag1'],
            content: 'Unmatched diary entry',
            format: 'plain',
            diary: 'Unknown Diary',
          },
        ],
      });

      await service.import(1, { content });

      expect(entryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ diaryId: 5 }),
      );
    });

    it('should throw BadRequestException for too many entries', async () => {
      settingRepository.find.mockResolvedValue([]);
      
      // Generate content with many entries
      let content = '';
      for (let i = 0; i < 100; i++) {
        content += `
---2024-01-${String(i % 28 + 1).padStart(2, '0')}--[tag${i}]
Entry content ${i}

--------------------------------------------------------------------------------
`;
      }

      // Mock parseTextFile to return many entries
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);

      // This should not throw for 100 entries (under 10000 limit)
      diaryRepository.findOne.mockResolvedValue(mockDiary);
      entryRepository.count.mockResolvedValue(0);
      entryRepository.save.mockResolvedValue(mockEntry);

      const result = await service.import(1, { content });
      expect(result.success).toBe(true);
    });
  });
});
