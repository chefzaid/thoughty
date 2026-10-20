import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { YearReviewMood } from '@/database/entities';
import type { YearEntry } from './year-review.service';
import { YearMoodService } from './year-mood.service';

describe('YearMoodService', () => {
  const manager = {
    delete: jest.fn(),
    create: jest.fn((_entity: unknown, values: object) => values),
    save: jest.fn(async (values: object) => ({ ...values, createdAt: new Date('2026-01-02T10:00:00Z') })),
  };
  const dataSource = { transaction: jest.fn(async (work: (entityManager: typeof manager) => unknown) => work(manager)) };
  const yearReviewService = { assertOwnedDiary: jest.fn(), loadYearEntries: jest.fn() };
  const aiYearMoodService = { read: jest.fn() };
  const service = new YearMoodService(dataSource as never, yearReviewService as never, aiYearMoodService as never);

  const entry = (id: number, date: string, overrides: Partial<YearEntry> = {}): YearEntry => ({
    id,
    date,
    index: 1,
    content: `Entry ${id} about the **day**.`,
    tags: [],
    isFavorite: false,
    isArchived: false,
    words: 5,
    ...overrides,
  });
  const reading = { months: [{ month: '2025-01', mood: 'hopeful', valence: 1 }], summary: 'A hopeful start.' };

  beforeEach(() => {
    jest.clearAllMocks();
    yearReviewService.assertOwnedDiary.mockResolvedValue(undefined);
  });

  it('sends up to five plain-text entries per month, spread across it, without archived or empty ones', async () => {
    yearReviewService.loadYearEntries.mockResolvedValue([
      ...Array.from({ length: 9 }, (_, index) => entry(index + 1, `2025-01-${String(index + 1).padStart(2, '0')}`)),
      entry(20, '2025-03-01', { isArchived: true }),
      entry(21, '2025-03-02', { words: 0, content: '' }),
      entry(22, '2025-03-03', { content: 'x'.repeat(900) }),
    ]);

    const { samples, analyzedEntries } = await service.sampleYear(7, 2025);

    expect(samples.map((sample) => [sample.month, sample.entries.map((item) => item.date)])).toEqual([
      ['2025-01', ['2025-01-01', '2025-01-03', '2025-01-05', '2025-01-07', '2025-01-09']],
      ['2025-03', ['2025-03-03']],
    ]);
    expect(samples[0].entries[0].text).toBe('Entry 1 about the day.');
    expect(samples[1].entries[0].text.length).toBeLessThanOrEqual(601);
    expect(analyzedEntries).toBe(6);
  });

  it('keeps the new reading in place of the old one for the same scope', async () => {
    yearReviewService.loadYearEntries.mockResolvedValue([entry(1, '2025-01-04')]);
    aiYearMoodService.read.mockResolvedValue(reading);

    const mood = await service.generate(7, 2025);

    expect(aiYearMoodService.read).toHaveBeenCalledWith(7, [{ month: '2025-01', entries: [{ date: '2025-01-04', text: 'Entry 1 about the day.' }] }]);
    expect(manager.delete).toHaveBeenCalledWith(YearReviewMood, { userId: 7, year: 2025, diaryId: IsNull() });
    expect(manager.create).toHaveBeenCalledWith(YearReviewMood, {
      userId: 7,
      year: 2025,
      diaryId: null,
      months: reading.months,
      summary: reading.summary,
      analyzedEntries: 1,
    });
    expect(mood).toEqual({ ...reading, analyzedEntries: 1, generatedAt: '2026-01-02T10:00:00.000Z' });
  });

  it('scopes the reading to a diary', async () => {
    yearReviewService.loadYearEntries.mockResolvedValue([entry(1, '2025-01-04')]);
    aiYearMoodService.read.mockResolvedValue(reading);

    await service.generate(7, 2025, 3);

    expect(yearReviewService.assertOwnedDiary).toHaveBeenCalledWith(7, 3);
    expect(yearReviewService.loadYearEntries).toHaveBeenCalledWith(7, 2025, 3);
    expect(manager.delete).toHaveBeenCalledWith(YearReviewMood, { userId: 7, year: 2025, diaryId: 3 });
  });

  it('refuses a year without entries and reports when AI cannot read it, keeping the old reading', async () => {
    yearReviewService.loadYearEntries.mockResolvedValueOnce([]);
    await expect(service.generate(7, 2019)).rejects.toBeInstanceOf(BadRequestException);

    yearReviewService.loadYearEntries.mockResolvedValueOnce([entry(1, '2025-01-04')]);
    aiYearMoodService.read.mockResolvedValueOnce(null);
    await expect(service.generate(7, 2025)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('refuses a diary the writer does not own before reading anything', async () => {
    yearReviewService.assertOwnedDiary.mockRejectedValue(new NotFoundException('Diary not found'));

    await expect(service.generate(7, 2025, 99)).rejects.toBeInstanceOf(NotFoundException);
    expect(yearReviewService.loadYearEntries).not.toHaveBeenCalled();
  });
});
