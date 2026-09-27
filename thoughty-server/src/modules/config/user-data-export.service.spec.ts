import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Attachment,
  CommentLike,
  Diary,
  Entry,
  EntryComment,
  EntryLike,
  EntryRevision,
  Setting,
  User,
  UserFollow,
} from '@/database/entities';
import { UserDataExportService } from './user-data-export.service';

describe('UserDataExportService', () => {
  let service: UserDataExportService;
  let settingRepository: any;
  let userRepository: any;
  let diaryRepository: any;
  let entryRepository: any;
  let revisionRepository: any;
  let attachmentRepository: any;
  let followRepository: any;
  let commentRepository: any;
  let entryLikeRepository: any;
  let commentLikeRepository: any;

  beforeEach(async () => {
    settingRepository = { find: jest.fn() };
    userRepository = { findOne: jest.fn() };
    diaryRepository = { find: jest.fn() };
    entryRepository = { find: jest.fn() };
    revisionRepository = { find: jest.fn() };
    attachmentRepository = { find: jest.fn() };
    followRepository = { find: jest.fn().mockResolvedValue([]) };
    commentRepository = { find: jest.fn().mockResolvedValue([]) };
    entryLikeRepository = { find: jest.fn().mockResolvedValue([]) };
    commentLikeRepository = { find: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserDataExportService,
        { provide: getRepositoryToken(Setting), useValue: settingRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Diary), useValue: diaryRepository },
        { provide: getRepositoryToken(Entry), useValue: entryRepository },
        { provide: getRepositoryToken(EntryRevision), useValue: revisionRepository },
        { provide: getRepositoryToken(Attachment), useValue: attachmentRepository },
        { provide: getRepositoryToken(UserFollow), useValue: followRepository },
        { provide: getRepositoryToken(EntryComment), useValue: commentRepository },
        { provide: getRepositoryToken(EntryLike), useValue: entryLikeRepository },
        { provide: getRepositoryToken(CommentLike), useValue: commentLikeRepository },
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
      {
        id: 1,
        name: 'My Diary',
        icon: '📓',
        color: '#E76F51',
        visibility: 'private',
        isDefault: true,
        position: 0,
        createdAt: new Date('2024-01-01'),
      },
    ]);
    entryRepository.find.mockResolvedValue([
      {
        id: 1,
        diaryId: 1,
        date: '2024-01-15',
        index: 1,
        content: 'Hello',
        tags: ['tag1'],
        format: 'plaintext',
        visibility: 'private',
        isFavorite: false,
        createdAt: new Date('2024-01-15'),
      },
    ]);
    revisionRepository.find.mockResolvedValue([]);
    attachmentRepository.find.mockResolvedValue([
      {
        id: 3,
        entryId: 1,
        originalFilename: 'voice.mp3',
        mimetype: 'audio/mpeg',
        size: 2048,
        transcript: 'Portable transcript',
        transcribedAt: new Date('2024-01-15T10:05:00Z'),
        createdAt: new Date('2024-01-15T10:00:00Z'),
      },
    ]);
    settingRepository.find.mockResolvedValue([
      { key: 'theme', value: 'dark', updatedAt: new Date('2024-01-01') },
    ]);
    followRepository.find.mockResolvedValue([
      {
        followerId: 1,
        followedId: 2,
        createdAt: new Date('2024-02-01'),
        followed: { id: 2, username: 'maya', email: 'maya@example.com' },
      },
    ]);
    commentRepository.find.mockResolvedValue([
      { id: 9, entryId: 40, userId: 1, content: 'Lovely', createdAt: new Date('2024-03-01') },
    ]);
    entryLikeRepository.find.mockResolvedValue([
      { entryId: 40, userId: 1, createdAt: new Date('2024-03-02') },
    ]);
    commentLikeRepository.find.mockResolvedValue([
      { commentId: 12, userId: 1, createdAt: new Date('2024-03-03') },
    ]);

    const result = await service.downloadData(1);

    expect(result.exportedAt).toBeDefined();
    expect(result.user).toEqual(
      expect.objectContaining({ id: 1, username: 'testuser', email: 'test@example.com' }),
    );
    expect(result.diaries).toHaveLength(1);
    expect(result.diaries).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#E76F51' })]),
    );
    expect(result.entries).toHaveLength(1);
    expect(result.revisions).toHaveLength(0);
    expect(result.attachments).toEqual([
      expect.objectContaining({
        id: 3,
        transcript: 'Portable transcript',
        transcribedAt: new Date('2024-01-15T10:05:00Z'),
      }),
    ]);
    expect(result.settings).toHaveLength(1);
    expect(result.following).toEqual([
      { userId: 2, username: 'maya', followedAt: new Date('2024-02-01') },
    ]);
    expect(result.comments).toEqual([
      { id: 9, entryId: 40, content: 'Lovely', createdAt: new Date('2024-03-01') },
    ]);
    expect(result.likes).toEqual({
      entries: [{ entryId: 40, likedAt: new Date('2024-03-02') }],
      comments: [{ commentId: 12, likedAt: new Date('2024-03-03') }],
    });
    expect(commentRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 1 } }),
    );
    expect(followRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { followerId: 1 } }),
    );
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
    userRepository.findOne.mockResolvedValue({
      id: 1,
      username: 'u',
      email: 'e',
      authProvider: 'local',
      avatarUrl: null,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
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

  it('excludes encrypted credentials from user data exports', async () => {
    userRepository.findOne.mockResolvedValue(null);
    diaryRepository.find.mockResolvedValue([]);
    entryRepository.find.mockResolvedValue([]);
    revisionRepository.find.mockResolvedValue([]);
    attachmentRepository.find.mockResolvedValue([]);
    settingRepository.find.mockResolvedValue([
      { key: 'theme', value: 'dark', updatedAt: new Date() },
      { key: 'openRouterApiKey', value: 'ciphertext', updatedAt: new Date() },
    ]);

    const result = await service.downloadData(1);

    expect(result.settings).toEqual([expect.objectContaining({ key: 'theme', value: 'dark' })]);
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
