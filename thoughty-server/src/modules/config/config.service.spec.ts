import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from './config.service';
import { Setting } from '@/database/entities';

describe('ConfigService', () => {
  let service: ConfigService;
  let settingRepository: any;

  beforeEach(async () => {
    settingRepository = {
      find: jest.fn(),
      upsert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigService,
        { provide: getRepositoryToken(Setting), useValue: settingRepository },
      ],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return default config when no settings exist', async () => {
      settingRepository.find.mockResolvedValue([]);

      const result = await service.getConfig(1);

      expect(result).toEqual({
        theme: 'dark',
        name: 'User',
        entriesPerPage: '10',
        defaultVisibility: 'private',
        language: 'en',
      });
    });

    it('should merge user settings with defaults', async () => {
      settingRepository.find.mockResolvedValue([
        { key: 'theme', value: 'light' },
        { key: 'name', value: 'John Doe' },
      ]);

      const result = await service.getConfig(1);

      expect(result.theme).toBe('light');
      expect(result.name).toBe('John Doe');
      expect(result.entriesPerPage).toBe('10'); // default
      expect(result.language).toBe('en'); // default
    });

    it('should override all defaults when all settings exist', async () => {
      settingRepository.find.mockResolvedValue([
        { key: 'theme', value: 'light' },
        { key: 'name', value: 'Jane Doe' },
        { key: 'entriesPerPage', value: '20' },
        { key: 'defaultVisibility', value: 'public' },
        { key: 'language', value: 'es' },
      ]);

      const result = await service.getConfig(1);

      expect(result).toEqual({
        theme: 'light',
        name: 'Jane Doe',
        entriesPerPage: '20',
        defaultVisibility: 'public',
        language: 'es',
      });
    });

    it('should handle custom settings not in defaults', async () => {
      settingRepository.find.mockResolvedValue([
        { key: 'customSetting', value: 'customValue' },
      ]);

      const result = await service.getConfig(1);

      expect(result.customSetting).toBe('customValue');
      expect(result.theme).toBe('dark'); // default still present
    });
  });

  describe('updateConfig', () => {
    it('should update single setting', async () => {
      settingRepository.upsert.mockResolvedValue({});

      const result = await service.updateConfig(1, { theme: 'light' });

      expect(result.success).toBe(true);
      expect(settingRepository.upsert).toHaveBeenCalledWith(
        { userId: 1, key: 'theme', value: 'light' },
        ['userId', 'key'],
      );
    });

    it('should update multiple settings', async () => {
      settingRepository.upsert.mockResolvedValue({});

      const result = await service.updateConfig(1, {
        theme: 'light',
        name: 'New Name',
        entriesPerPage: '25',
      });

      expect(result.success).toBe(true);
      expect(settingRepository.upsert).toHaveBeenCalledTimes(3);
    });

    it('should convert non-string values to strings', async () => {
      settingRepository.upsert.mockResolvedValue({});

      await service.updateConfig(1, {
        entriesPerPage: '50',
      });

      expect(settingRepository.upsert).toHaveBeenCalledWith(
        { userId: 1, key: 'entriesPerPage', value: '50' },
        ['userId', 'key'],
      );
    });

    it('should handle empty config object', async () => {
      const result = await service.updateConfig(1, {});

      expect(result.success).toBe(true);
      expect(settingRepository.upsert).not.toHaveBeenCalled();
    });
  });
});
