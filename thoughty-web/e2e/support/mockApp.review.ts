import type { MockEntry } from "./mockApp.shared";
import { buildMockMoods } from "./mockApp.stats";

/** Year-in-review state for the mock API; the handlers are in mockApp.routes.review.ts. */
export interface MockYearMood {
  months: Array<{ month: string; mood: string; valence: number }>;
  summary: string;
  analyzedEntries: number;
  generatedAt: string;
}

export interface MockReviewState {
  aiAvailable: boolean;
  /** Saved mood readings by `year:diary`. */
  moods: Record<string, MockYearMood>;
  moodRequests: unknown[];
}

export function createMockReviewState(): MockReviewState {
  return { aiAvailable: true, moods: {}, moodRequests: [] };
}

const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** The arc from the moods recorded that year, without AI; null when none was recorded. */
function recordedMoodOf(entries: MockEntry[]) {
  const moods = buildMockMoods(entries);
  if (moods.recordedEntries === 0 || moods.averageMood === null) {
    return null;
  }
  return { entries: moods.recordedEntries, average: moods.averageMood, months: moods.months, topFeelings: moods.topFeelings.slice(0, 5) };
}

/** A small version of the server's review: enough for the browser flows, not its exact rules. */
export function buildMockReview(entries: MockEntry[], year: number, diaryId: number | null, state: MockReviewState) {
  const scoped = entries.filter((entry) => diaryId === null || (entry.diaryId ?? 1) === diaryId);
  const inYear = scoped.filter((entry) => entry.date.startsWith(`${year}-`)).sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index);
  const months = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, entries: 0, words: 0 }));
  const weekdays = Array.from({ length: 7 }, () => 0);
  const tags = new Map<string, number>();
  for (const entry of inYear) {
    const month = months[Number(entry.date.slice(5, 7)) - 1]!;
    month.entries++;
    month.words += countWords(entry.content);
    weekdays[(new Date(`${entry.date}T00:00:00Z`).getUTCDay() + 6) % 7]!++;
    for (const tag of entry.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
  }
  const words = months.reduce((sum, month) => sum + month.words, 0);
  const highlight = (kind: string, entry: MockEntry) => ({
    kind,
    entryId: entry.id,
    date: entry.date,
    excerpt: entry.content.slice(0, 220),
    words: countWords(entry.content),
    tags: entry.tags,
  });
  const first = inYear[0];
  const last = inYear.at(-1);
  const favorites = inYear.filter((entry) => entry.is_favorite && entry !== first && entry !== last);

  return {
    year,
    diaryId,
    availableYears: [...new Set(scoped.map((entry) => Number(entry.date.slice(0, 4))))].sort((a, b) => b - a),
    totals: {
      entries: inYear.length,
      words,
      writingDays: new Set(inYear.map((entry) => entry.date)).size,
      longestStreak: inYear.length > 0 ? 1 : 0,
      favorites: inYear.filter((entry) => entry.is_favorite).length,
      attachments: inYear.reduce((sum, entry) => sum + (entry.attachments?.length ?? 0), 0),
      averageWords: inYear.length > 0 ? Math.round(words / inYear.length) : 0,
    },
    previousYear: null,
    months,
    weekdays,
    topTags: [...tags.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    newTags: [],
    highlights: [
      ...(first ? [highlight("first", first)] : []),
      ...favorites.slice(0, 4).map((entry) => highlight("favorite", entry)),
      ...(last && last !== first ? [highlight("last", last)] : []),
    ],
    mood: state.moods[`${year}:${diaryId ?? "all"}`] ?? null,
    recordedMood: recordedMoodOf(inYear),
    aiAvailable: state.aiAvailable,
  };
}
