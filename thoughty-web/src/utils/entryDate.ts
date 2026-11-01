/** A journal date such as 2026-10-21, written out for the reader's language ("October 21, 2026"). */
export function formatJournalDate(date: string, language: string): string {
  const [year = 1970, month = 1, day = 1] = date.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export const formatEntryDate = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * The writer's own day (`YYYY-MM-DD`) at `now` in their time zone (the browser's by default), as the
 * API's `today` parameter takes it: "today", "this week", "this month" and "this year" go by it.
 */
export const writersToday = (now: Date = new Date(), timeZone?: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};
