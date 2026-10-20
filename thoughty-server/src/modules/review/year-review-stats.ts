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

/** Markdown reduced to readable text, cut at a word boundary. */
export function plainExcerpt(content: string, maxLength: number): string {
  const text = content
    .replaceAll(/```[\s\S]*?```/g, ' ')
    .replaceAll(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replaceAll(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replaceAll(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, '')
    .replaceAll(/[*_~`]+/g, '')
    .replaceAll(/\\([\\`*_[\]{}()#+\-.!>])/g, '$1')
    .replaceAll(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) {
    return text;
  }
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
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
