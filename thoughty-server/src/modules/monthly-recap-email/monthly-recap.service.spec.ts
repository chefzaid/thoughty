import type { YearEntry } from '@/modules/review';
import { MonthlyRecapService } from './monthly-recap.service';

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

describe('MonthlyRecapService', () => {
  const memory = { entry: { id: 90, date: '2019-10-04' }, yearsAgo: 7 };
  let yearReviewService: { loadEntries: jest.Mock };
  let entriesQueryService: { findMonthMemory: jest.Mock };
  let service: MonthlyRecapService;

  beforeEach(() => {
    yearReviewService = { loadEntries: jest.fn().mockResolvedValue([]) };
    entriesQueryService = { findMonthMemory: jest.fn().mockResolvedValue(null) };
    service = new MonthlyRecapService(yearReviewService as never, entriesQueryService as never);
  });

  it('counts the month’s entries, words, writing days, top three tags and recorded moods', async () => {
    yearReviewService.loadEntries.mockResolvedValue([
      written(1, '2026-10-02', { tags: ['sea', 'family'], mood: 4 }),
      written(2, '2026-10-02', { tags: ['family'], words: 5, mood: 3 }),
      written(3, '2026-10-30', { tags: ['work', 'art', 'family', 'sea'] }),
    ]);
    entriesQueryService.findMonthMemory.mockResolvedValue(memory);

    await expect(service.build(3, { year: 2026, month: 10 }, 4)).resolves.toEqual({
      year: 2026,
      month: 10,
      diaryId: 4,
      entries: 3,
      words: 25,
      writingDays: 2,
      topTags: [{ tag: 'family', count: 3 }, { tag: 'sea', count: 2 }, { tag: 'art', count: 1 }],
      mood: { average: 3.5, entries: 2 },
      memory,
    });
    expect(yearReviewService.loadEntries).toHaveBeenCalledWith(3, { from: '2026-10-01', to: '2026-10-31' }, 4);
    expect(entriesQueryService.findMonthMemory).toHaveBeenCalledWith(3, { year: 2026, month: 10, diaryId: 4 });
  });

  it('keeps a memory for a month without writing, without a mood summary', async () => {
    entriesQueryService.findMonthMemory.mockResolvedValue(memory);

    const recap = await service.build(3, { year: 2026, month: 2 }, null);

    expect(recap).toEqual(expect.objectContaining({ entries: 0, words: 0, writingDays: 0, topTags: [], mood: null, memory }));
    expect(yearReviewService.loadEntries).toHaveBeenCalledWith(3, { from: '2026-02-01', to: '2026-02-28' }, undefined);
  });

  it('skips a month with neither entries nor a memory', async () => {
    await expect(service.build(3, { year: 2026, month: 10 }, null)).resolves.toBeNull();
  });
});
