import { rankTags } from './year-review-stats';
import { summarizeRecordedMoods, type YearEntry } from './year-review.service';

/** How much a stretch of entries holds, as the recap emails tell it: counts, the most used tags and the recorded moods. */
export interface WritingSummary {
  entries: number;
  words: number;
  writingDays: number;
  topTags: Array<{ tag: string; count: number }>;
  /** The moods the writer recorded, without AI; null when none was. */
  mood: { average: number; entries: number } | null;
}

/** The entries' counts, their `topTags` most used tags and the average of the moods recorded on them. */
export function summarizeWriting(entries: YearEntry[], topTags: number): WritingSummary {
  const mood = summarizeRecordedMoods(entries);
  return {
    entries: entries.length,
    words: entries.reduce((sum, entry) => sum + entry.words, 0),
    writingDays: new Set(entries.map((entry) => entry.date)).size,
    topTags: rankTags(entries).slice(0, topTags),
    mood: mood ? { average: mood.average, entries: mood.entries } : null,
  };
}
