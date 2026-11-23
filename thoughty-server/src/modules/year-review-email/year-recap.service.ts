import { Injectable } from '@nestjs/common';
import { summarizeWriting, type WritingSummary, type YearEntry, YearReviewService } from '@/modules/review';
import { longestStreak } from '@/modules/review/year-review-stats';

/** Tags the year in review email names at most. */
export const YEAR_RECAP_TOP_TAGS = 5;

/** One year of writing, as the year in review email tells it. */
export interface YearRecap extends WritingSummary {
  year: number;
  diaryId: number | null;
  /** The most days in a row with an entry. */
  longestStreak: number;
  /** The month (1 to 12) with the most entries, the earliest of equal ones. */
  busiestMonth: { month: number; entries: number };
}

function busiestMonth(entries: YearEntry[]): YearRecap['busiestMonth'] {
  const counts = Array.from({ length: 12 }, () => 0);
  for (const entry of entries) {
    counts[Number(entry.date.slice(5, 7)) - 1]++;
  }
  const most = Math.max(...counts);
  return { month: counts.indexOf(most) + 1, entries: most };
}

/**
 * Gathers a year's recap from what the year in review reads: the year's entries, with the recycle bin and
 * locked entries left out (the email goes out with no unlocked session), and nothing an AI wrote.
 */
@Injectable()
export class YearRecapService {
  constructor(private readonly yearReviewService: YearReviewService) {}

  /** The year's recap, or null when the writer has no entry dated that year. */
  async build(userId: number, year: number, diaryId: number | null): Promise<YearRecap | null> {
    const entries = await this.yearReviewService.loadYearEntries(userId, year, diaryId ?? undefined, { leaveLockedOut: true });
    if (entries.length === 0) {
      return null;
    }
    return {
      year,
      diaryId,
      ...summarizeWriting(entries, YEAR_RECAP_TOP_TAGS),
      longestStreak: longestStreak(entries.map((entry) => entry.date)),
      busiestMonth: busiestMonth(entries),
    };
  }
}
