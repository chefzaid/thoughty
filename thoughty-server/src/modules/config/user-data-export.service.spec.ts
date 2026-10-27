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
  MemoirAnswer,
  YearReviewMood,
  SavedSearch,
  LifeEra,
  MemoirProgram,
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
  let memoirProgramRepository: any;
  let memoirAnswerRepository: any;
  let yearReviewMoodRepository: any;
  let savedSearchRepository: any;
  let lifeEraRepository: any;

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
    memoirProgramRepository = { findOne: jest.fn().mockResolvedValue(null) };
    memoirAnswerRepository = { find: jest.fn().mockResolvedValue([]) };
    yearReviewMoodRepository = { find: jest.fn().mockResolvedValue([]) };
    savedSearchRepository = { find: jest.fn().mockResolvedValue([]) };
    lifeEraRepository = { find: jest.fn().mockResolvedValue([]) };

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
        { provide: getRepositoryToken(MemoirProgram), useValue: memoirProgramRepository },
        { provide: getRepositoryToken(MemoirAnswer), useValue: memoirAnswerRepository },
        { provide: getRepositoryToken(YearReviewMood), useValue: yearReviewMoodRepository },
        { provide: getRepositoryToken(SavedSearch), useValue: savedSearchRepository },
        { provide: getRepositoryToken(LifeEra), useValue: lifeEraRepository },
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
        goalType: 'entries_per_week',
        goalTarget: 3,
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
        deletedAt: null,
      },
      {
        id: 2,
        diaryId: 1,
        date: '2024-01-16',
        index: 1,
        content: 'Deleted yesterday',
        tags: [],
        format: 'plaintext',
        visibility: 'private',
        isFavorite: false,
        createdAt: new Date('2024-01-16'),
        deletedAt: new Date('2024-02-01T08:00:00Z'),
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
      expect.arrayContaining([expect.objectContaining({ color: '#E76F51', goalType: 'entries_per_week', goalTarget: 3 })]),
    );
    expect(entryRepository.find).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 1 }, withDeleted: true }));
    expect(result.entries).toEqual([
      expect.objectContaining({ id: 1, deletedAt: null }),
      expect.objectContaining({ id: 2, deletedAt: new Date('2024-02-01T08:00:00Z') }),
    ]);
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
    expect(result.memoir).toEqual({ program: null, answers: [] });
    expect(commentRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 1 } }),
    );
    expect(followRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { followerId: 1 } }),
    );
  });

  it('includes the guided memoir program and which entries answer which questions', async () => {
    userRepository.findOne.mockResolvedValue(null);
    diaryRepository.find.mockResolvedValue([]);
    entryRepository.find.mockResolvedValue([]);
    revisionRepository.find.mockResolvedValue([]);
    attachmentRepository.find.mockResolvedValue([]);
    settingRepository.find.mockResolvedValue([]);
    memoirProgramRepository.findOne.mockResolvedValue({
      userId: 1,
      diaryId: 6,
      status: 'active',
      emailEnabled: true,
      deliveryWeekday: 0,
      timeZone: 'Europe/Paris',
      currentQuestionId: 'childhood-play',
      nextDeliveryAt: new Date('2026-10-25T08:00:00Z'),
      lastEmailedAt: null,
      createdAt: new Date('2026-10-04T15:20:00Z'),
    });
    memoirAnswerRepository.find.mockResolvedValue([
      { userId: 1, questionId: 'childhood-home', entryId: 81, createdAt: new Date('2026-10-05T09:00:00Z') },
    ]);

    const result = await service.downloadData(1);

    expect(result.memoir).toEqual({
      program: {
        diaryId: 6,
        status: 'active',
        emailEnabled: true,
        deliveryWeekday: 0,
        timeZone: 'Europe/Paris',
        currentQuestionId: 'childhood-play',
        nextDeliveryAt: new Date('2026-10-25T08:00:00Z'),
        lastEmailedAt: null,
        startedAt: new Date('2026-10-04T15:20:00Z'),
      },
      answers: [{ questionId: 'childhood-home', entryId: 81, answeredAt: new Date('2026-10-05T09:00:00Z') }],
    });
    expect(memoirAnswerRepository.find).toHaveBeenCalledWith({ where: { userId: 1 }, order: { createdAt: 'ASC' } });
  });

  it('includes the mood readings saved with year reviews', async () => {
    for (const repository of [diaryRepository, entryRepository, revisionRepository, attachmentRepository, settingRepository]) {
      repository.find.mockResolvedValue([]);
    }
    yearReviewMoodRepository.find.mockResolvedValue([
      {
        userId: 1,
        year: 2025,
        diaryId: null,
        months: [{ month: '2025-01', mood: 'hopeful', valence: 1 }],
        summary: 'A hopeful start.',
        analyzedEntries: 4,
        createdAt: new Date('2026-01-02T10:00:00Z'),
      },
    ]);

    const result = await service.downloadData(1);

    expect(result.yearReviewMoods).toEqual([
      {
        year: 2025,
        diaryId: null,
        months: [{ month: '2025-01', mood: 'hopeful', valence: 1 }],
        summary: 'A hopeful start.',
        analyzedEntries: 4,
        generatedAt: new Date('2026-01-02T10:00:00Z'),
      },
    ]);
    expect(yearReviewMoodRepository.find).toHaveBeenCalledWith({ where: { userId: 1 }, order: { year: 'ASC', createdAt: 'ASC' } });
  });

  it('includes the saved searches with their filters and diary scope', async () => {
    for (const repository of [diaryRepository, entryRepository, revisionRepository, attachmentRepository, settingRepository]) {
      repository.find.mockResolvedValue([]);
    }
    const filters = {
      search: '', searchMode: 'keyword', sort: 'relevance', tags: ['family'], date: null,
      visibility: 'all', archiveStatus: 'active', favorites: true, mood: '',
    };
    savedSearchRepository.find.mockResolvedValue([
      {
        id: 3,
        userId: 1,
        name: 'Family favorites',
        diaryId: 2,
        filters,
        createdAt: new Date('2026-10-01T10:00:00Z'),
        updatedAt: new Date('2026-10-02T10:00:00Z'),
      },
    ]);

    const result = await service.downloadData(1);

    expect(result.savedSearches).toEqual([
      {
        name: 'Family favorites',
        diaryId: 2,
        filters,
        createdAt: new Date('2026-10-01T10:00:00Z'),
        updatedAt: new Date('2026-10-02T10:00:00Z'),
      },
    ]);
    expect(savedSearchRepository.find).toHaveBeenCalledWith({ where: { userId: 1 }, order: { createdAt: 'ASC', id: 'ASC' } });
  });

  it('includes the life eras with the ID saved searches refer to, without the owner', async () => {
    for (const repository of [diaryRepository, entryRepository, revisionRepository, attachmentRepository, settingRepository]) {
      repository.find.mockResolvedValue([]);
    }
    const createdAt = new Date('2026-10-01T10:00:00Z');
    lifeEraRepository.find.mockResolvedValue([
      { id: 4, userId: 1, name: 'University', startDate: '2010-09-01', endDate: null, color: '#2A9D8F', emoji: '🎓', note: 'Lyon', createdAt, updatedAt: createdAt },
    ]);

    const result = await service.downloadData(1);

    expect(result.lifeEras).toEqual([
      { id: 4, name: 'University', startDate: '2010-09-01', endDate: null, color: '#2A9D8F', emoji: '🎓', note: 'Lyon', createdAt, updatedAt: createdAt },
    ]);
    expect(lifeEraRepository.find).toHaveBeenCalledWith({ where: { userId: 1 }, order: { startDate: 'ASC', id: 'ASC' } });
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

  it('says a cloud provider is connected without exporting its tokens or internal state', async () => {
    userRepository.findOne.mockResolvedValue(null);
    diaryRepository.find.mockResolvedValue([]);
    entryRepository.find.mockResolvedValue([]);
    revisionRepository.find.mockResolvedValue([]);
    attachmentRepository.find.mockResolvedValue([]);
    const updatedAt = new Date();
    settingRepository.find.mockResolvedValue(
      [
        'cloud_google_drive_access_token',
        'cloud_google_drive_refresh_token',
        'cloud_google_drive_expires_at',
        'cloud_google_drive_last_sync_hash',
        'cloud_google_drive_connected_at',
        'cloud_google_drive_sync_enabled',
        'cloud_google_drive_sync_frequency',
        'cloud_google_drive_last_sync_at',
        'io_dateFormat',
        'legacyUnknownSetting',
      ].map((key) => ({ key, value: 'v', updatedAt })),
    );

    const result = await service.downloadData(1);
    const keys = (result.settings as Array<{ key: string }>).map((setting) => setting.key);

    expect(keys).toEqual([
      'cloud_google_drive_connected_at',
      'cloud_google_drive_sync_enabled',
      'cloud_google_drive_sync_frequency',
      'cloud_google_drive_last_sync_at',
      'io_dateFormat',
    ]);
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
