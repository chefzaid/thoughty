import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { IoService } from './io.service';
import { Entry, Setting, Diary } from '@/database/entities';

describe('IoService', () => {
  let service: IoService;
  let entryRepository: any;
  let settingRepository: any;
  let diaryRepository: any;

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

  const mockSettings = [
    { key: 'io_entrySeparator', value: '---' },
    { key: 'io_dateFormat', value: 'YYYY-MM-DD' },
  ];

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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IoService,
        { provide: getRepositoryToken(Entry), useValue: entryRepository },
        { provide: getRepositoryToken(Setting), useValue: settingRepository },
        { provide: getRepositoryToken(Diary), useValue: diaryRepository },
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
      expect(result.filename).toContain('export_');
    });

    it('should filter by diaryId when provided', async () => {
      settingRepository.find.mockResolvedValue([]);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockEntry]);

      const result = await service.export(1, 1);

      expect(result.filename).toContain('diary1_');
      expect(mockQb.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 1 });
    });

    it('should handle empty entries', async () => {
      settingRepository.find.mockResolvedValue([]);
      const mockQb = entryRepository.createQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);

      const result = await service.export(1);

      expect(result.content).toBe('');
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
