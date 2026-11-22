import { roundMood } from '@/modules/stats/stats-mood.service';
import { dayParts } from '@/common/utils/writers-day.util';

/** How many months, the writer's month last, the mentions over time show one by one. */
export const PERSON_MENTION_MONTHS = 12;

/** One month with mentions as the database sums it up. */
export interface MentionMonthRow {
  month: string;
  entries: number | string;
  moodEntries: number | string;
  moodSum: number | string | null;
}

export interface MentionPeriod {
  period: string;
  entries: number;
  moodEntries: number;
  averageMood: number | null;
}

export interface MentionsOverTime {
  entries: number;
  months: MentionPeriod[];
  years: MentionPeriod[];
}

/**
 * The entries dated up to the writer's day `$2` that mention any of the people `$3`, each counted once, summed up per
 * month with their moods: neither in the recycle bin nor sealed (a sealed time capsule keeps no mood), nor locked unless
 * the request is unlocked (`lockFilter`).
 */
export const mentionMonthsSql = (lockFilter: string) => `
  SELECT to_char(e.date, 'YYYY-MM') AS month, COUNT(*)::int AS entries,
         COUNT(e.mood)::int AS "moodEntries", SUM(e.mood)::int AS "moodSum"
    FROM entries e
   WHERE e.user_id = $1 AND e.deleted_at IS NULL AND e.sealed_until IS NULL AND e.date <= $2::date${lockFilter}
     AND EXISTS (SELECT 1 FROM entry_people ep WHERE ep.entry_id = e.id AND ep.person_id = ANY($3::int[]))
   GROUP BY 1
   ORDER BY 1`;

interface Totals {
  entries: number;
  moodEntries: number;
  moodSum: number;
}

const toPeriod = (period: string, totals: Totals | undefined): MentionPeriod => ({
  period,
  entries: totals?.entries ?? 0,
  moodEntries: totals?.moodEntries ?? 0,
  averageMood: totals?.moodEntries ? roundMood(totals.moodSum / totals.moodEntries) : null,
});

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

/**
 * The months and years of the mentions over time, from the database's months with a mention: the last
 * `PERSON_MENTION_MONTHS` months ending with the month of `today`, and every year from the first mention to the year
 * of `today`, each period without a mention counting 0.
 */
export function mentionsOverTime(rows: readonly MentionMonthRow[], today: string): MentionsOverTime {
  const byMonth = new Map<string, Totals>();
  const byYear = new Map<string, Totals>();
  for (const row of rows) {
    const totals = { entries: Number(row.entries), moodEntries: Number(row.moodEntries), moodSum: Number(row.moodSum ?? 0) };
    byMonth.set(row.month, totals);
    const year = row.month.slice(0, 4);
    const sum = byYear.get(year) ?? { entries: 0, moodEntries: 0, moodSum: 0 };
    byYear.set(year, {
      entries: sum.entries + totals.entries,
      moodEntries: sum.moodEntries + totals.moodEntries,
      moodSum: sum.moodSum + totals.moodSum,
    });
  }

  const { year, month } = dayParts(today);
  const months = Array.from({ length: PERSON_MENTION_MONTHS }, (_, index) => {
    const offset = year * 12 + (month - 1) - (PERSON_MENTION_MONTHS - 1 - index);
    const key = monthKey(Math.floor(offset / 12), (offset % 12) + 1);
    return toPeriod(key, byMonth.get(key));
  });
  const firstYear = rows.length ? Number(rows[0].month.slice(0, 4)) : year + 1;
  const years = Array.from({ length: Math.max(0, year - firstYear + 1) }, (_, index) => {
    const key = String(firstYear + index);
    return toPeriod(key, byYear.get(key));
  });
  return { entries: years.reduce((sum, period) => sum + period.entries, 0), months, years };
}
