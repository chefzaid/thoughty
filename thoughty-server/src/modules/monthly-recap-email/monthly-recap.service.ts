import { Injectable } from '@nestjs/common';
import { EntriesQueryService, type OnThisDayEntry } from '@/modules/entries';
import { summarizeRecordedMoods, YearReviewService } from '@/modules/review';
import { rankTags } from '@/modules/review/year-review-stats';
import { monthRange, type RecapMonth } from './monthly-recap-schedule';

/** Tags the recap names at most. */
export const RECAP_TOP_TAGS = 3;

/** One month of writing, as the monthly recap email tells it. */
export interface MonthlyRecap extends RecapMonth {
  diaryId: number | null;
  entries: number;
  words: number;
  writingDays: number;
  topTags: Array<{ tag: string; count: number }>;
  /** The moods the writer recorded that month, without AI; null when none was. */
  mood: { average: number; entries: number } | null;
  /** One entry from the same calendar month in an earlier year. */
  memory: OnThisDayEntry | null;
}

/**
 * Gathers a month's recap from what the year in review and Highlights already read: the month's entries
 * (recycle bin left out) and one memory of that month in an earlier year.
 */
@Injectable()
export class MonthlyRecapService {
  constructor(
    private readonly yearReviewService: YearReviewService,
    private readonly entriesQueryService: EntriesQueryService,
  ) {}

  /** The month's recap, or null when the writer neither wrote that month nor has a memory of it. */
  async build(userId: number, month: RecapMonth, diaryId: number | null): Promise<MonthlyRecap | null> {
    const [entries, memory] = await Promise.all([
      this.yearReviewService.loadEntries(userId, monthRange(month), diaryId ?? undefined),
      this.entriesQueryService.findMonthMemory(userId, { ...month, diaryId }),
    ]);
    if (entries.length === 0 && !memory) {
      return null;
    }

    const mood = summarizeRecordedMoods(entries);
    return {
      ...month,
      diaryId,
      entries: entries.length,
      words: entries.reduce((sum, entry) => sum + entry.words, 0),
      writingDays: new Set(entries.map((entry) => entry.date)).size,
      topTags: rankTags(entries).slice(0, RECAP_TOP_TAGS),
      mood: mood ? { average: mood.average, entries: mood.entries } : null,
      memory,
    };
  }
}
