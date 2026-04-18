import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from './config.service';
import { Setting, User, Diary, Entry, EntryRevision, Attachment } from '@/database/entities';

describe('ConfigService', () => {
  let service: ConfigService;
  let settingRepository: any;
  let userRepository: any;
  let diaryRepository: any;
  let entryRepository: any;
  let revisionRepository: any;
  let attachmentRepository: any;

  beforeEach(async () => {
    settingRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      upsert: jest.fn(),
    };
    userRepository = { findOne: jest.fn() };
    diaryRepository = { find: jest.fn() };
    entryRepository = { find: jest.fn() };
    revisionRepository = { find: jest.fn() };
    attachmentRepository = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigService,
        { provide: getRepositoryToken(Setting), useValue: settingRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Diary), useValue: diaryRepository },
        { provide: getRepositoryToken(Entry), useValue: entryRepository },
        { provide: getRepositoryToken(EntryRevision), useValue: revisionRepository },
        { provide: getRepositoryToken(Attachment), useValue: attachmentRepository },
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
        autoTagMaxTags: '0',
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
      expect(result.autoTagMaxTags).toBe('0');
    });

    it('should override all defaults when all settings exist', async () => {
      settingRepository.find.mockResolvedValue([
        { key: 'theme', value: 'light' },
        { key: 'name', value: 'Jane Doe' },
        { key: 'entriesPerPage', value: '20' },
        { key: 'defaultVisibility', value: 'public' },
        { key: 'language', value: 'es' },
        { key: 'autoTagMaxTags', value: '4' },
      ]);

      const result = await service.getConfig(1);

      expect(result).toEqual({
        theme: 'light',
        name: 'Jane Doe',
        entriesPerPage: '20',
        defaultVisibility: 'public',
        language: 'es',
        autoTagMaxTags: '4',
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

    it('should encrypt sensitive keys when saving', async () => {
      settingRepository.upsert.mockResolvedValue({});

      await service.updateConfig(1, { openRouterApiKey: 'sk-or-test-key-12345' });

      expect(settingRepository.upsert).toHaveBeenCalledTimes(1);
      const call = settingRepository.upsert.mock.calls[0];
      expect(call[0].key).toBe('openRouterApiKey');
      // Value should be encrypted (contains colons from iv:authTag:encrypted format)
      expect(call[0].value).toContain(':');
      expect(call[0].value).not.toBe('sk-or-test-key-12345');
    });

    it('should skip masked sensitive values', async () => {
      settingRepository.upsert.mockResolvedValue({});

      await service.updateConfig(1, { openRouterApiKey: '***************2345' });

      expect(settingRepository.upsert).not.toHaveBeenCalled();
    });
  });

  describe('sensitive key handling', () => {
    it('should mask API key in getConfig', async () => {
      // First store an encrypted key
      settingRepository.upsert.mockResolvedValue({});
      await service.updateConfig(1, { openRouterApiKey: 'sk-or-test-key-12345' });

      const encryptedValue = settingRepository.upsert.mock.calls[0][0].value;

      settingRepository.find.mockResolvedValue([
        { key: 'openRouterApiKey', value: encryptedValue },
      ]);

      const config = await service.getConfig(1);
      expect(config.openRouterApiKey).toMatch(/^\*+2345$/);
      expect(config.openRouterApiKey).not.toBe('sk-or-test-key-12345');
    });

    it('should return decrypted value via getDecryptedConfig', async () => {
      settingRepository.upsert.mockResolvedValue({});
      await service.updateConfig(1, { openRouterApiKey: 'sk-or-test-key-12345' });

      const encryptedValue = settingRepository.upsert.mock.calls[0][0].value;

      settingRepository.findOne.mockResolvedValue({ key: 'openRouterApiKey', value: encryptedValue });

      const decrypted = await service.getDecryptedConfig(1, 'openRouterApiKey');
      expect(decrypted).toBe('sk-or-test-key-12345');
    });

    it('should return empty string for non-existent key', async () => {
      settingRepository.findOne.mockResolvedValue(null);

      const result = await service.getDecryptedConfig(1, 'openRouterApiKey');
      expect(result).toBe('');
    });
  });

  describe('downloadData', () => {
    it('should return all user data', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        authProvider: 'local',
        avatarUrl: null,
        emailVerified: true,
        passwordHash: 'hashed',
        resetToken: 'token',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-06-01'),
      });
      diaryRepository.find.mockResolvedValue([
        { id: 1, name: 'My Diary', icon: '📓', visibility: 'private', isDefault: true, position: 0, createdAt: new Date('2024-01-01') },
      ]);
      entryRepository.find.mockResolvedValue([
        { id: 1, diaryId: 1, date: '2024-01-15', index: 1, content: 'Hello', tags: ['tag1'], format: 'plaintext', visibility: 'private', isFavorite: false, createdAt: new Date('2024-01-15') },
      ]);
      revisionRepository.find.mockResolvedValue([]);
      attachmentRepository.find.mockResolvedValue([]);
      settingRepository.find.mockResolvedValue([
        { key: 'theme', value: 'dark', updatedAt: new Date('2024-01-01') },
      ]);

      const result = await service.downloadData(1);

      expect(result.exportedAt).toBeDefined();
      expect(result.user).toEqual(expect.objectContaining({ id: 1, username: 'testuser', email: 'test@example.com' }));
      expect(result.diaries).toHaveLength(1);
      expect(result.entries).toHaveLength(1);
      expect(result.revisions).toHaveLength(0);
      expect(result.attachments).toHaveLength(0);
      expect(result.settings).toHaveLength(1);
    });

    it('should exclude sensitive fields from user data', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        authProvider: 'local',
        avatarUrl: null,
        emailVerified: true,
        passwordHash: 'secret-hash',
        resetToken: 'secret-token',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-06-01'),
      });
      diaryRepository.find.mockResolvedValue([]);
      entryRepository.find.mockResolvedValue([]);
      revisionRepository.find.mockResolvedValue([]);
      attachmentRepository.find.mockResolvedValue([]);
      settingRepository.find.mockResolvedValue([]);

      const result = await service.downloadData(1);
      const user = result.user as Record<string, unknown>;

      expect(user.passwordHash).toBeUndefined();
      expect(user.resetToken).toBeUndefined();
    });

    it('should exclude sensitive settings', async () => {
      userRepository.findOne.mockResolvedValue({ id: 1, username: 'u', email: 'e', authProvider: 'local', avatarUrl: null, emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
      diaryRepository.find.mockResolvedValue([]);
      entryRepository.find.mockResolvedValue([]);
      revisionRepository.find.mockResolvedValue([]);
      attachmentRepository.find.mockResolvedValue([]);
      settingRepository.find.mockResolvedValue([
        { key: 'theme', value: 'dark', updatedAt: new Date() },
        { key: 'openRouterApiKey', value: 'encrypted-value', updatedAt: new Date() },
      ]);

      const result = await service.downloadData(1);
      const settings = result.settings as Array<{ key: string }>;

      expect(settings).toHaveLength(1);
      expect(settings[0].key).toBe('theme');
    });

    it('should handle null user gracefully', async () => {
      userRepository.findOne.mockResolvedValue(null);
      diaryRepository.find.mockResolvedValue([]);
      entryRepository.find.mockResolvedValue([]);
      revisionRepository.find.mockResolvedValue([]);
      attachmentRepository.find.mockResolvedValue([]);
      settingRepository.find.mockResolvedValue([]);

      const result = await service.downloadData(1);

      expect(result.user).toBeNull();
    });
  });
});
