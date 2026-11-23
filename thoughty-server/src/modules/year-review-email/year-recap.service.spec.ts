import type { YearEntry } from '@/modules/review';
import { YearRecapService } from './year-recap.service';

const written = (id: number, date: string, overrides: Partial<YearEntry> = {}): YearEntry => ({
  id,
  date,
  index: 1,
  content: 'word '.repeat(10),
  tags: [],
  isFavorite: false,
  isArchived: false,
  mood: null,
  feelings: [],
  words: 10,
  ...overrides,
});

describe('YearRecapService', () => {
  let yearReviewService: { loadYearEntries: jest.Mock };
  let service: YearRecapService;

  beforeEach(() => {
    yearReviewService = { loadYearEntries: jest.fn().mockResolvedValue([]) };
    service = new YearRecapService(yearReviewService as never);
  });

  it('counts the year’s entries, words, writing days, longest streak, busiest month, top five tags and recorded moods', async () => {
    yearReviewService.loadYearEntries.mockResolvedValue([
      written(1, '2026-03-01', { tags: ['sea', 'family'], mood: 4 }),
      written(2, '2026-03-02', { tags: ['family', 'work'], words: 5, mood: 3 }),
      written(3, '2026-03-03', { tags: ['art', 'family', 'sea', 'books', 'music'] }),
      written(4, '2026-07-10', { tags: ['travel'] }),
      written(5, '2026-07-10', {}),
      written(6, '2026-11-30', { mood: 5 }),
    ]);

    await expect(service.build(3, 2026, 4)).resolves.toEqual({
      year: 2026,
      diaryId: 4,
      entries: 6,
      words: 55,
      writingDays: 5,
      longestStreak: 3,
      busiestMonth: { month: 3, entries: 3 },
      topTags: [
        { tag: 'family', count: 3 },
        { tag: 'sea', count: 2 },
        { tag: 'art', count: 1 },
        { tag: 'books', count: 1 },
        { tag: 'music', count: 1 },
      ],
      mood: { average: 4, entries: 3 },
    });
    expect(yearReviewService.loadYearEntries).toHaveBeenCalledWith(3, 2026, 4, { leaveLockedOut: true });
  });

  it('takes the earliest of equally busy months, and no mood when none was recorded', async () => {
    yearReviewService.loadYearEntries.mockResolvedValue([written(1, '2026-02-01'), written(2, '2026-09-01')]);

    const recap = await service.build(3, 2026, null);

    expect(recap).toEqual(expect.objectContaining({ busiestMonth: { month: 2, entries: 1 }, longestStreak: 1, mood: null, topTags: [] }));
    expect(yearReviewService.loadYearEntries).toHaveBeenCalledWith(3, 2026, undefined, { leaveLockedOut: true });
  });

  it('skips a year without entries', async () => {
    await expect(service.build(3, 2026, null)).resolves.toBeNull();
  });
});
