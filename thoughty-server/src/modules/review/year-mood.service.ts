import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { YearReviewMood } from '@/database/entities';
import { AiYearMoodService, type YearMoodSample } from '@/modules/ai';
import type { YearReviewMoodDto } from './dto';
import { toMoodDto, YearReviewService } from './year-review.service';
import { plainExcerpt, sampleEvenly } from './year-review-stats';

const ENTRIES_PER_MONTH = 5;
const CHARACTERS_PER_ENTRY = 600;

/** Reads the mood of each month with AI, only when the writer asks, and keeps the latest reading. */
@Injectable()
export class YearMoodService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly yearReviewService: YearReviewService,
    private readonly aiYearMoodService: AiYearMoodService,
  ) {}

  /** Up to five entries per month, spread across it, as plain text of at most 600 characters. */
  async sampleYear(userId: number, year: number, diaryId?: number): Promise<{ samples: YearMoodSample[]; analyzedEntries: number }> {
    const entries = (await this.yearReviewService.loadYearEntries(userId, year, diaryId))
      .filter((entry) => !entry.isArchived && entry.words > 0);
    const byMonth = new Map<string, typeof entries>();
    for (const entry of entries) {
      const month = entry.date.slice(0, 7);
      byMonth.set(month, [...(byMonth.get(month) ?? []), entry]);
    }
    const samples = [...byMonth.entries()].map(([month, monthEntries]) => ({
      month,
      entries: sampleEvenly(monthEntries, ENTRIES_PER_MONTH).map((entry) => ({
        date: entry.date,
        text: plainExcerpt(entry.content, CHARACTERS_PER_ENTRY),
      })),
    }));
    return { samples, analyzedEntries: samples.reduce((sum, sample) => sum + sample.entries.length, 0) };
  }

  async generate(userId: number, year: number, diaryId?: number): Promise<YearReviewMoodDto> {
    await this.yearReviewService.assertOwnedDiary(userId, diaryId);
    const { samples, analyzedEntries } = await this.sampleYear(userId, year, diaryId);
    if (samples.length === 0) {
      throw new BadRequestException('There are no entries to read in this year');
    }

    const reading = await this.aiYearMoodService.read(userId, samples);
    if (!reading) {
      throw new ServiceUnavailableException('The mood of the year could not be read right now');
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      await manager.delete(YearReviewMood, { userId, year, diaryId: diaryId ?? IsNull() });
      return manager.save(
        manager.create(YearReviewMood, {
          userId,
          year,
          diaryId: diaryId ?? null,
          months: reading.months,
          summary: reading.summary,
          analyzedEntries,
        }),
      );
    });
    return toMoodDto(saved);
  }
}
