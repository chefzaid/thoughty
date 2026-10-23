import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from './config.service';
import { Setting } from '@/database/entities';

describe('ConfigService', () => {
  let service: ConfigService;
  let settingRepository: any;

  beforeEach(async () => {
    settingRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
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
        fontFamily: 'system',
        fontSize: '16',
        highContrast: 'false',
        entriesPerPage: '10',
        maxPinnedEntries: '3',
        defaultVisibility: 'private',
        language: 'en',
        autoTagMaxTags: '0',
        subscriptionPlan: 'free',
        paymentMethodLabel: '',
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
      expect(result.fontFamily).toBe('system');
      expect(result.fontSize).toBe('16');
      expect(result.highContrast).toBe('false');
      expect(result.entriesPerPage).toBe('10'); // default
      expect(result.language).toBe('en'); // default
      expect(result.autoTagMaxTags).toBe('0');
    });

    it('should override all defaults when all settings exist', async () => {
      settingRepository.find.mockResolvedValue([
        { key: 'theme', value: 'light' },
        { key: 'name', value: 'Jane Doe' },
        { key: 'fontFamily', value: 'serif' },
        { key: 'fontSize', value: '18' },
        { key: 'highContrast', value: 'true' },
        { key: 'entriesPerPage', value: '20' },
        { key: 'defaultVisibility', value: 'public' },
        { key: 'language', value: 'fr' },
        { key: 'autoTagMaxTags', value: '4' },
      ]);

      const result = await service.getConfig(1);

      expect(result).toEqual({
        theme: 'light',
        name: 'Jane Doe',
        fontFamily: 'serif',
        fontSize: '18',
        highContrast: 'true',
        entriesPerPage: '20',
        maxPinnedEntries: '3',
        defaultVisibility: 'public',
        language: 'fr',
        autoTagMaxTags: '4',
        subscriptionPlan: 'free',
        paymentMethodLabel: '',
      });
    });

    it('returns only user preferences, never cloud tokens, sync state, or unknown keys', async () => {
      settingRepository.find.mockResolvedValue([
        { key: 'theme', value: 'light' },
        { key: 'tagMetadata', value: '{"work":{"color":"#ff0000"}}' },
        { key: 'customSetting', value: 'customValue' },
        { key: 'cloud_google_drive_access_token', value: 'iv:tag:ciphertext' },
        { key: 'cloud_google_drive_refresh_token', value: 'iv:tag:ciphertext' },
        { key: 'cloud_dropbox_last_sync_hash', value: 'abc' },
        { key: 'cloud_onedrive_sync_enabled', value: 'true' },
        { key: 'io_dateFormat', value: 'YYYY-MM-DD' },
      ]);

      const result = await service.getConfig(1);

      expect(result.theme).toBe('light');
      expect(result.tagMetadata).toBe('{"work":{"color":"#ff0000"}}');
      expect(Object.keys(result).filter((key) => /^(cloud_|io_|custom)/.test(key))).toEqual([]);
    });

    it('falls back to defaults for stored values the preferences form would refuse', async () => {
      settingRepository.find.mockResolvedValue([
        { key: 'theme', value: 'purple' },
        { key: 'language', value: 'es' },
        { key: 'fontColor', value: 'red' },
        { key: 'name', value: 'Kept' },
      ]);

      const result = await service.getConfig(1);

      expect(result.theme).toBe('dark');
      expect(result.language).toBe('en');
      expect(result.fontColor).toBeUndefined();
      expect(result.name).toBe('Kept');
    });

    it('never exposes encrypted credentials in general configuration', async () => {
      settingRepository.find.mockResolvedValue([
        { key: 'theme', value: 'light' },
        { key: 'openRouterApiKey', value: 'encrypted-secret' },
      ]);

      const result = await service.getConfig(1);

      expect(result.theme).toBe('light');
      expect(result.openRouterApiKey).toBeUndefined();
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

    it.each(['openRouterApiKey', 'cloud_google_drive_access_token', 'io_dateFormat', 'customSetting'])(
      'refuses to write the reserved or unknown setting %s and writes nothing',
      async (key) => {
        await expect(
          service.updateConfig(1, { theme: 'light', [key]: 'value' } as never),
        ).rejects.toThrow(BadRequestException);
        expect(settingRepository.upsert).not.toHaveBeenCalled();
      },
    );

    it('skips preferences left undefined', async () => {
      await service.updateConfig(1, { theme: 'light', name: undefined });

      expect(settingRepository.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDecryptedConfig', () => {
    it('should return empty string for non-existent key', async () => {
      settingRepository.findOne.mockResolvedValue(null);

      const result = await service.getDecryptedConfig(1, 'openRouterModel');
      expect(result).toBe('');
    });

    it('encrypts sensitive values at rest and decrypts them on dedicated reads', async () => {
      let storedValue = '';
      settingRepository.upsert.mockImplementation(async (value: { value: string }) => {
        storedValue = value.value;
      });
      settingRepository.findOne.mockImplementation(async () => ({ value: storedValue }));

      await service.setEncryptedConfig(1, 'openRouterApiKey', 'sk-or-v1-personal-secret');

      expect(storedValue).not.toContain('sk-or-v1-personal-secret');
      await expect(service.getDecryptedConfig(1, 'openRouterApiKey')).resolves.toBe(
        'sk-or-v1-personal-secret',
      );
    });

    it('returns an empty value when encrypted data is corrupted', async () => {
      settingRepository.findOne.mockResolvedValue({ value: 'not-valid-ciphertext' });

      await expect(service.getDecryptedConfig(1, 'openRouterApiKey')).resolves.toBe('');
    });
  });
});
