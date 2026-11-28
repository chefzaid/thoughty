import { currentContentAccess } from '@/common/content-lock';
import { asUnlocked } from '@/common/content-lock/content-lock.test-helpers';
import { PublicApiService } from './public-api.service';

const token = { tokenId: 1, userId: 5, email: 'w@example.com', username: 'writer', scopes: ['entries:write' as const], timeZone: 'Pacific/Auckland' };

const listedEntry = {
  id: 57, user_id: 5, diary_id: 2, date: '2026-11-21', index: 1, title: 'Walk', time_of_day: '08:30', mood: 4,
  feelings: ['calm'], location: { name: 'River path', latitude: null, longitude: null }, tags: ['walk'],
  content: 'By the river', format: 'plain', visibility: 'private', is_favorite: false, is_archived: false, is_pinned: false, created_at: new Date('2026-11-21T08:31:00Z'),
  sealed_until: null, reread_on: null, is_locked: false, diary_locked: false, withheld: false,
};

describe('PublicApiService', () => {
  const diaryRepository = { find: jest.fn() };
  const entriesService = { getEntries: jest.fn(), create: jest.fn() };
  const service = new PublicApiService(diaryRepository as never, entriesService as never);

  beforeEach(() => jest.clearAllMocks());

  it('lists the writer’s diaries in their order, with only what a script needs', async () => {
    diaryRepository.find.mockResolvedValue([
      { id: 2, userId: 5, name: 'Travel', icon: '✈️', isDefault: false, isLocked: true, position: 0, color: '#123456' },
    ]);

    await expect(service.listDiaries(5)).resolves.toEqual({
      diaries: [{ id: 2, name: 'Travel', icon: '✈️', isDefault: false, isLocked: true }],
    });
    expect(diaryRepository.find).toHaveBeenCalledWith({ where: { userId: 5 }, order: { position: 'ASC', id: 'ASC' } });
  });

  it('lists a page of entries through the journal list, never with a PIN unlock', async () => {
    let unlockedWhileListing: number | null = -1;
    entriesService.getEntries.mockImplementation(async () => {
      unlockedWhileListing = currentContentAccess().unlockedUserId;
      return { entries: [listedEntry], total: 1, offset: 0, nextCursor: 'next', prevCursor: null, allTags: ['walk'] };
    });

    const page = await asUnlocked(5, () => service.listEntries(5, { diaryId: 2, search: 'river', after: 'cursor' }));

    expect(unlockedWhileListing).toBeNull();
    expect(entriesService.getEntries).toHaveBeenCalledWith(5, { limit: 20, after: 'cursor', diaryId: 2, search: 'river' });
    expect(page).toEqual({
      nextCursor: 'next',
      entries: [{
        id: 57, diaryId: 2, date: '2026-11-21', index: 1, title: 'Walk', timeOfDay: '08:30', text: 'By the river',
        format: 'plain', tags: ['walk'], mood: 4, feelings: ['calm'], location: { name: 'River path', latitude: null, longitude: null },
        visibility: 'private', withheld: false,
        sealedUntil: null, createdAt: listedEntry.created_at,
      }],
    });
  });

  it('writes a private entry for today in the token’s time zone without a date', async () => {
    entriesService.create.mockResolvedValue({ success: true, entryId: 58 });

    // 20:00 UTC on the 21st is already the 22nd in Auckland
    const created = await service.createEntry(token, { text: 'Hello #walk' }, new Date('2026-11-21T20:00:00Z'));

    expect(created).toEqual({ id: 58, date: '2026-11-22' });
    expect(entriesService.create).toHaveBeenCalledWith(5, { text: 'Hello #walk', tags: [], date: '2026-11-22', visibility: 'private' });
  });

  it('keeps the day, tags and diary sent', async () => {
    entriesService.create.mockResolvedValue({ success: true, entryId: 59 });

    await expect(service.createEntry(token, { text: 'Old note', date: '2020-01-02', tags: ['memo'], diaryId: 2 }))
      .resolves.toEqual({ id: 59, date: '2020-01-02' });
    expect(entriesService.create).toHaveBeenCalledWith(5, {
      text: 'Old note', date: '2020-01-02', tags: ['memo'], diaryId: 2, visibility: 'private',
    });
  });
});
