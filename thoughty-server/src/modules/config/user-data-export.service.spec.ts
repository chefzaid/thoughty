import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Attachment, Diary, Entry, EntryRevision, Setting, User } from '@/database/entities';
import { UserDataExportService } from './user-data-export.service';

describe('UserDataExportService', () => {
  let service: UserDataExportService;
  let settingRepository: any;
  let userRepository: any;
  let diaryRepository: any;
  let entryRepository: any;
  let revisionRepository: any;
  let attachmentRepository: any;

  beforeEach(async () => {
    settingRepository = { find: jest.fn() };
    userRepository = { findOne: jest.fn() };
    diaryRepository = { find: jest.fn() };
    entryRepository = { find: jest.fn() };
    revisionRepository = { find: jest.fn() };
    attachmentRepository = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserDataExportService,
        { provide: getRepositoryToken(Setting), useValue: settingRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Diary), useValue: diaryRepository },
        { provide: getRepositoryToken(Entry), useValue: entryRepository },
        { provide: getRepositoryToken(EntryRevision), useValue: revisionRepository },
        { provide: getRepositoryToken(Attachment), useValue: attachmentRepository },
      ],
    }).compile();

    service = module.get<UserDataExportService>(UserDataExportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

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
      { id: 1, name: 'My Diary', icon: '📓', color: '#E76F51', visibility: 'private', isDefault: true, position: 0, createdAt: new Date('2024-01-01') },
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
    expect(result.diaries).toEqual(expect.arrayContaining([expect.objectContaining({ color: '#E76F51' })]));
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

  it('should include all settings in export', async () => {
    userRepository.findOne.mockResolvedValue({ id: 1, username: 'u', email: 'e', authProvider: 'local', avatarUrl: null, emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
    diaryRepository.find.mockResolvedValue([]);
    entryRepository.find.mockResolvedValue([]);
    revisionRepository.find.mockResolvedValue([]);
    attachmentRepository.find.mockResolvedValue([]);
    settingRepository.find.mockResolvedValue([
      { key: 'theme', value: 'dark', updatedAt: new Date() },
      { key: 'openRouterModel', value: 'openai/gpt-4o', updatedAt: new Date() },
    ]);

    const result = await service.downloadData(1);
    const settings = result.settings as Array<{ key: string }>;

    expect(settings).toHaveLength(2);
    expect(settings[0].key).toBe('theme');
    expect(settings[1].key).toBe('openRouterModel');
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