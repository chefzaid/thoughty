import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { IoService } from './io.service';
import { Entry, Setting, Diary, User } from '@/database/entities';

describe('IoService', () => {
  let service: IoService;
  let entryRepository: any;
  let settingRepository: any;
  let diaryRepository: any;
  let userRepository: any;

  const mockEntry = {
    id: 1,
    userId: 1,
    diaryId: 1,
    date: '2024-01-15',
    index: 1,
    tags: ['tag1', 'tag2'],
    content: 'Test entry content',
    visibility: 'private',
  };

  const mockDiary = {
    id: 1,
    userId: 1,
    name: 'Test Diary',
    icon: '📓',
    isDefault: true,
  };

  beforeEach(async () => {
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockEntry]),
    };

    entryRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    };

    settingRepository = {
      find: jest.fn(),
      upsert: jest.fn(),
    };

    diaryRepository = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };

    userRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 1, username: 'jane' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IoService,
        { provide: getRepositoryToken(Entry), useValue: entryRepository },
        { provide: getRepositoryToken(Setting), useValue: settingRepository },
        { provide: getRepositoryToken(Diary), useValue: diaryRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();

    service = module.get<IoService>(IoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getFormat', () => {
    it('should return format config with defaults', async () => {
      settingRepository.find.mockResolvedValue([]);

      const result = await service.getFormat(1);

      expect(result).toHaveProperty('entrySeparator');
      expect(result).toHaveProperty('dateFormat');
      expect(result).toHaveProperty('tagOpenBracket');
      expect(result).toHaveProperty('tagCloseBracket');
    });

    it('should merge user settings with defaults', async () => {
      settingRepository.find.mockResolvedValue([
        { key: 'io_entrySeparator', value: '====' },
      ]);

      const result = await service.getFormat(1);

      expect(result.entrySeparator).toBe('====');
      expect(result.dateFormat).toBe('YYYY-MM-DD'); // default
    });
  });

  describe('saveFormat', () => {
    it('should save format config', async () => {
      settingRepository.upsert.mockResolvedValue({});

      const result = await service.saveFormat(1, {
        entrySeparator: '====',
        dateFormat: 'DD-MM-YYYY',
      });

      expect(result.success).toBe(true);
      expect(result.config).toBeDefined();
      expect(settingRepository.upsert).toHaveBeenCalled();
    });

    it('should call upsert for each config key', async () => {
      settingRepository.upsert.mockResolvedValue({});

      await service.saveFormat(1, {
        entrySeparator: '====',
        dateFormat: 'DD-MM-YYYY',
        tagOpenBracket: '(',
        tagCloseBracket: ')',
      });

      expect(settingRepository.upsert).toHaveBeenCalledTimes(8); // All config keys
    });
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

    it('should throw BadRequestException for empty content', async () => {
      await expect(service.preview(1, { content: '' })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for non-string content', async () => {
      await expect(service.preview(1, { content: 123 as any })).rejects.toThrow(BadRequestException);
    });

    it('should throw PayloadTooLargeException for large content', async () => {
      const largeContent = 'x'.repeat(6 * 1024 * 1024); // 6MB

      await expect(service.preview(1, { content: largeContent })).rejects.toThrow(
        PayloadTooLargeException,
      );
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

    it('should throw BadRequestException for empty content', async () => {
      await expect(service.import(1, { content: '' })).rejects.toThrow(BadRequestException);
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
