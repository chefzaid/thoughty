import type { components } from '../../src/generated/openapi';
import { compareSameDayEntries } from '../../src/utils/entryTime';

interface RecordsEntry {
  id: number;
  date: string;
  index: number;
  content: string;
  time_of_day?: string | null;
  createdAt?: string;
  capsule?: { openedAt: string | null };
}

type Records = components['schemas']['StatsRecordsDto'];

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** Words as the API counts them; a sealed time capsule keeps no text there, so it has none. */
function countWords(entry: RecordsEntry): number {
  const text = entry.capsule && !entry.capsule.openedAt ? '' : entry.content.trim();
  return text ? text.split(/\s+/).length : 0;
}

/** The entry's local time as the API reads it: a typed time as it is, otherwise the creation time in `timeZone`. */
function localTime(entry: RecordsEntry, timeZone: string): string {
  if (entry.time_of_day) return entry.time_of_day.slice(0, 5);
  // Entries without a creation time were created at noon UTC on their date, as the entry responses say
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(entry.createdAt ?? `${entry.date}T12:00:00.000Z`));
  const part = (type: string) => parts.find((candidate) => candidate.type === type)?.value ?? '00';
  return `${part('hour')}:${part('minute')}`;
}

const toRecordEntry = (entry: RecordsEntry) => ({ entryId: entry.id, date: entry.date, index: entry.index });

/** The personal records as the API finds them, ties going to the first written (by date, then in the day's order). */
export function buildMockRecords(entries: RecordsEntry[], timeZone = 'UTC'): Records {
  const ordered = [...entries].sort((left, right) => left.date.localeCompare(right.date) || compareSameDayEntries(left, right));
  const best = <T>(score: (entry: RecordsEntry) => T, better: (candidate: T, current: T) => boolean) =>
    ordered.reduce<RecordsEntry | undefined>((current, entry) => (current === undefined || better(score(entry), score(current)) ? entry : current), undefined);

  const longest = best(countWords, (candidate, current) => candidate > current);
  const earliest = best((entry) => localTime(entry, timeZone), (candidate, current) => candidate < current);
  const latest = best((entry) => localTime(entry, timeZone), (candidate, current) => candidate > current);

  const perDay = new Map<string, number>();
  for (const entry of ordered) perDay.set(entry.date, (perDay.get(entry.date) ?? 0) + 1);
  let busiestDay: Records['busiestDay'] = null;
  let longestStreak: Records['longestStreak'] = null;
  let start = '';
  let previous = '';
  let days = 0;
  for (const [date, count] of perDay) {
    if (!busiestDay || count > busiestDay.entries) busiestDay = { date, entries: count };
    const follows = previous !== '' && Date.parse(`${date}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`) === DAY_IN_MS;
    days = follows ? days + 1 : 1;
    start = follows ? start : date;
    if (!longestStreak || days > longestStreak.days) longestStreak = { days, startDate: start, endDate: date };
    previous = date;
  }

  return {
    longestEntry: longest && countWords(longest) > 0 ? { ...toRecordEntry(longest), words: countWords(longest) } : null,
    busiestDay,
    longestStreak,
    earliestEntry: earliest ? { ...toRecordEntry(earliest), time: localTime(earliest, timeZone) } : null,
    latestEntry: latest ? { ...toRecordEntry(latest), time: localTime(latest, timeZone) } : null,
    firstEntry: ordered[0] ? toRecordEntry(ordered[0]) : null,
  };
}
