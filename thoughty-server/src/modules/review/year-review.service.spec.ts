import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import { Attachment, Diary, Entry, YearReviewMood } from '@/database/entities';
import { AiCredentialsService } from '@/modules/ai';
import { YearReviewService } from './year-review.service';

interface FakeEntry {
  id: number;
  date: string;
  index?: number;
  content: string;
  tags?: string[];
  isFavorite?: boolean;
  isArchived?: boolean;
}

describe('YearReviewService', () => {
  let service: YearReviewService;
  let entries: FakeEntry[];
  let years: number[];
  let earlierTags: string[];
  let previousYear: { entries: string; days: string; words: string } | undefined;
  let attachmentCount: number;
  let builders: Array<Record<string, jest.Mock>>;
  const diaryRepository = { exists: jest.fn() };
  const moodRepository = { findOne: jest.fn() };
  const aiCredentialsService = { getStatus: jest.fn() };

  /** A chainable query builder whose result depends on what it selects. */
  function createBuilder() {
    const calls: string[] = [];
    const builder: Record<string, jest.Mock> = {};
    for (const method of ['select', 'addSelect', 'where', 'andWhere', 'orderBy', 'addOrderBy', 'innerJoin']) {
      builder[method] = jest.fn((first: unknown) => {
        calls.push(`${method}:${String(first)}`);
        return builder;
      });
    }
    builder.getRawAndEntities = jest.fn(async () => ({
      entities: entries.map((entry) => ({ index: 1, tags: [], isFavorite: false, isArchived: false, ...entry })),
      raw: [...entries].reverse().map((entry) => ({ e_id: entry.id, day: entry.date })),
    }));
    builder.getRawMany = jest.fn(async () =>
      calls.some((call) => call.includes('EXTRACT(YEAR'))
        ? years.map((year) => ({ year: String(year) }))
        : earlierTags.map((tag) => ({ tag })),
    );
    builder.getRawOne = jest.fn(async () => previousYear);
    builder.getCount = jest.fn(async () => attachmentCount);
    builders.push(builder);
    return builder;
  }

  beforeEach(async () => {
    entries = [];
    years = [2025];
    earlierTags = [];
    previousYear = undefined;
    attachmentCount = 0;
    builders = [];
    diaryRepository.exists.mockResolvedValue(true);
    moodRepository.findOne.mockResolvedValue(null);
    aiCredentialsService.getStatus.mockResolvedValue({ aiAvailable: true });

    const moduleRef = await Test.createTestingModule({
      providers: [
        YearReviewService,
        { provide: getRepositoryToken(Entry), useValue: { createQueryBuilder: jest.fn(createBuilder) } },
        { provide: getRepositoryToken(Diary), useValue: diaryRepository },
        { provide: getRepositoryToken(Attachment), useValue: { createQueryBuilder: jest.fn(createBuilder) } },
        { provide: getRepositoryToken(YearReviewMood), useValue: moodRepository },
        { provide: AiCredentialsService, useValue: aiCredentialsService },
      ],
    }).compile();
    service = moduleRef.get(YearReviewService);
  });

  it('adds up the year: totals, months, weekdays, streak, and tags', async () => {
    entries = [
      { id: 1, date: '2025-01-06', content: 'Back to work after the holidays.', tags: ['work'] },
      { id: 2, date: '2025-01-07', content: 'Snow on the way home.', tags: ['work', 'winter', 'work'] },
      { id: 3, date: '2025-01-08', content: 'Tired but fine.', tags: ['health'], isFavorite: true },
      { id: 4, date: '2025-03-15', content: '', tags: ['travel'] },
      { id: 5, date: '2025-03-15', content: 'Two entries on one day.', tags: ['travel', 'work'] },
    ];
    years = [2025, 2024];
    earlierTags = ['work'];
    previousYear = { entries: '2', days: '2', words: '40' };
    attachmentCount = 3;

    const review = await service.getReview(7, 2025);

    expect(review.totals).toEqual({ entries: 5, words: 19, writingDays: 4, longestStreak: 3, favorites: 1, attachments: 3, averageWords: 4 });
    expect(review.previousYear).toEqual({ entries: 2, words: 40, writingDays: 2 });
    expect(review.availableYears).toEqual([2025, 2024]);
    expect(review.months[0]).toEqual({ month: 1, entries: 3, words: 14 });
    expect(review.months[2]).toEqual({ month: 3, entries: 2, words: 5 });
    expect(review.months).toHaveLength(12);
    expect(review.weekdays).toEqual([1, 1, 1, 0, 0, 2, 0]);
    expect(review.topTags).toEqual([
      { tag: 'work', count: 3 },
      { tag: 'travel', count: 2 },
      { tag: 'health', count: 1 },
      { tag: 'winter', count: 1 },
    ]);
    expect(review.newTags).toEqual(['travel', 'health', 'winter']);
    expect(review).toEqual(expect.objectContaining({ year: 2025, diaryId: null, mood: null, aiAvailable: true }));
    expect(moodRepository.findOne).toHaveBeenCalledWith({ where: { userId: 7, year: 2025, diaryId: IsNull() } });
  });

  it('picks the first and last entries, favorites, and the longest entry, skipping archived and empty ones', async () => {
    entries = [
      { id: 1, date: '2025-01-01', content: '', tags: [] },
      { id: 2, date: '2025-01-02', content: '# New year\n\nA **quiet** start.', tags: ['new'] },
      { id: 3, date: '2025-04-10', content: 'A favorite day at the lake with everyone.', isFavorite: true },
      { id: 4, date: '2025-06-01', content: 'word '.repeat(80), isFavorite: false },
      { id: 5, date: '2025-07-01', content: 'Archived but long. '.repeat(30), isArchived: true, isFavorite: true },
      { id: 6, date: '2025-12-30', content: 'Last one.' },
    ];

    const { highlights } = await service.getReview(7, 2025);

    expect(highlights.map(({ kind, entryId }) => [kind, entryId])).toEqual([
      ['first', 2],
      ['favorite', 3],
      ['longest', 4],
      ['last', 6],
    ]);
    expect(highlights[0]).toEqual({ kind: 'first', entryId: 2, date: '2025-01-02', excerpt: 'New year A quiet start.', words: 6, tags: ['new'] });
    expect(highlights[2].excerpt.endsWith('…')).toBe(true);
  });

  it('does not repeat a lone entry as both first and last', async () => {
    entries = [{ id: 9, date: '2025-05-05', content: 'Only entry.' }];

    const { highlights } = await service.getReview(7, 2025);

    expect(highlights.map(({ kind }) => kind)).toEqual(['first']);
  });

  it('reports an empty year and no comparison', async () => {
    years = [];
    aiCredentialsService.getStatus.mockResolvedValue({ aiAvailable: false });

    const review = await service.getReview(7, 2024);

    expect(review.totals).toEqual({ entries: 0, words: 0, writingDays: 0, longestStreak: 0, favorites: 0, attachments: 0, averageWords: 0 });
    expect(review.previousYear).toBeNull();
    expect(review.highlights).toEqual([]);
    expect(review.aiAvailable).toBe(false);
  });

  it('scopes every query to an owned diary and returns its saved mood', async () => {
    moodRepository.findOne.mockResolvedValue({
      months: [{ month: '2025-01', mood: 'calm', valence: 1 }],
      summary: 'Calm.',
      analyzedEntries: 3,
      createdAt: new Date('2026-01-02T10:00:00Z'),
    });

    const review = await service.getReview(7, 2025, 4);

    expect(diaryRepository.exists).toHaveBeenCalledWith({ where: { id: 4, userId: 7 } });
    for (const builder of builders) {
      expect(builder.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 4 });
    }
    expect(moodRepository.findOne).toHaveBeenCalledWith({ where: { userId: 7, year: 2025, diaryId: 4 } });
    expect(review.mood).toEqual({
      months: [{ month: '2025-01', mood: 'calm', valence: 1 }],
      summary: 'Calm.',
      analyzedEntries: 3,
      generatedAt: '2026-01-02T10:00:00.000Z',
    });
  });

  it('refuses a diary the writer does not own', async () => {
    diaryRepository.exists.mockResolvedValue(false);

    await expect(service.getReview(7, 2025, 99)).rejects.toBeInstanceOf(NotFoundException);
    expect(builders).toHaveLength(0);
  });
});
