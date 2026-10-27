const DAY_MS = 24 * 60 * 60 * 1000;

/** Words as the stats page counts them: runs of non-whitespace. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** The most consecutive calendar days with at least one entry; `dates` are `YYYY-MM-DD`. */
export function longestStreak(dates: string[]): number {
  const days = [...new Set(dates)].map((date) => Date.parse(`${date}T00:00:00Z`)).sort((first, second) => first - second);
  let longest = 0;
  let current = 0;
  for (const [index, day] of days.entries()) {
    current = index > 0 && day - days[index - 1] === DAY_MS ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

/** Monday is 0, as in ISO weeks. */
export function isoWeekdayIndex(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** Up to `count` items spread evenly from first to last, keeping their order. */
export function sampleEvenly<T>(items: T[], count: number): T[] {
  if (items.length <= count) {
    return items;
  }
  if (count <= 1) {
    return items.slice(0, count);
  }
  const step = (items.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, index) => items[Math.round(index * step)]);
}

/** Each tag with the number of entries that carry it, most used first, then alphabetically. */
export function rankTags(entries: Array<{ tags: string[] }>): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of new Set(entry.tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((first, second) => second.count - first.count || first.tag.localeCompare(second.tag));
}
