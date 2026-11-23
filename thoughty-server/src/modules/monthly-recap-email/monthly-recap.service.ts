import { Injectable } from '@nestjs/common';
import { EntriesQueryService, type OnThisDayEntry } from '@/modules/entries';
import { summarizeWriting, type WritingSummary, YearReviewService } from '@/modules/review';
import { monthRange, type RecapMonth } from './monthly-recap-schedule';

/** Tags the recap names at most. */
export const RECAP_TOP_TAGS = 3;

/** One month of writing, as the monthly recap email tells it. */
export interface MonthlyRecap extends RecapMonth, WritingSummary {
  diaryId: number | null;
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

    return { ...month, diaryId, ...summarizeWriting(entries, RECAP_TOP_TAGS), memory };
  }
}
