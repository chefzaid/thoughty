type GoalType = 'entries_per_week' | 'words_per_day';

interface GoalDiary {
  id: number;
  name: string;
  icon: string;
  goalType?: GoalType | null;
  goalTarget?: number | null;
}

interface GoalEntry {
  date: string;
  content: string;
  diaryId?: number | null;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00.000Z`) + days * DAY_IN_MS).toISOString().slice(0, 10);
const mondayOf = (day: string) => addDays(day, -((new Date(`${day}T00:00:00.000Z`).getUTCDay() + 6) % 7));
const countWords = (content: string) => (content.trim() ? content.trim().split(/\s+/).length : 0);

/** Writing goal progress as the API measures it: up to the writer's day, weeks from Monday. */
export function buildMockGoals(entries: GoalEntry[], diaries: GoalDiary[], diaryId: number | null, today: string) {
  return diaries
    .filter((diary) => diary.goalType && diary.goalTarget && (diaryId === null || diary.id === diaryId))
    .map((diary) => {
      const type = diary.goalType as GoalType;
      const target = diary.goalTarget as number;
      const step = type === 'words_per_day' ? 1 : 7;
      const periodStart = type === 'words_per_day' ? today : mondayOf(today);
      const totals = new Map<string, number>();
      for (const entry of entries) {
        if ((entry.diaryId ?? 1) !== diary.id || entry.date > today) continue;
        const key = type === 'words_per_day' ? entry.date : mondayOf(entry.date);
        totals.set(key, (totals.get(key) ?? 0) + (type === 'words_per_day' ? countWords(entry.content) : 1));
      }
      const metPeriods = [...totals].filter(([, total]) => total >= target).map(([period]) => period).sort();
      const met = new Set(metPeriods);
      let currentStreak = 0;
      for (let cursor = met.has(periodStart) ? periodStart : addDays(periodStart, -step); met.has(cursor); cursor = addDays(cursor, -step)) {
        currentStreak += 1;
      }
      let longestStreak = 0;
      let run = 0;
      metPeriods.forEach((period, index) => {
        run = index > 0 && addDays(metPeriods[index - 1]!, step) === period ? run + 1 : 1;
        longestStreak = Math.max(longestStreak, run);
      });
      const progress = totals.get(periodStart) ?? 0;

      return {
        diaryId: diary.id,
        diaryName: diary.name,
        diaryIcon: diary.icon,
        goalType: type,
        goalTarget: target,
        period: type === 'words_per_day' ? 'day' : 'week',
        periodStart,
        progress,
        met: progress >= target,
        currentStreak,
        longestStreak,
        metPeriods,
      };
    });
}
