import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** The days or Monday-to-Sunday weeks that met the diary's writing goal, each by its first day. */
export interface HeatmapGoal {
    readonly period: 'day' | 'week';
    readonly metPeriods: readonly string[];
    /** The period still running (today, or this week's Monday): not met yet rather than missed. */
    readonly periodStart?: string;
}

export interface HeatmapDay {
    readonly date: Date;
    /** `YYYY-MM-DD` */
    readonly dateKey: string;
    /** The Monday of the day's week, `YYYY-MM-DD`. */
    readonly weekStart: string;
    readonly count: number;
    /** Words written that day, when the server sent them. */
    readonly words?: number;
}

/** What the heatmap says about one day, line by line: its tooltip and, joined, its accessible name. */
export interface HeatmapDayDetails {
    /** The long date in the reader's language ("Thursday, January 18, 2024"). */
    readonly date: string;
    /** "3 entries", "1 entry" or "No entries". */
    readonly entries: string;
    /** "1,240 words" or "1 word"; null on a day without words. */
    readonly words: string | null;
    /** Whether the diary's goal was met that day or week; null without a goal. */
    readonly goal: string | null;
    readonly goalMet: boolean;
}

/** The long, localized date of a day of the heatmap, read in UTC as its key is. */
export function heatmapDateFormatter(language: Language): Intl.DateTimeFormat {
    return new Intl.DateTimeFormat(language, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

function describeGoal(day: HeatmapDay, goal: HeatmapGoal, metPeriods: ReadonlySet<string>): { text: string; met: boolean } {
    const period = goal.period === 'day' ? day.dateKey : day.weekStart;
    const prefix = goal.period === 'day' ? 'statsHeatmapGoalDay' : 'statsHeatmapGoalWeek';
    if (metPeriods.has(period)) return { text: `${prefix}Met`, met: true };
    return { text: period === goal.periodStart ? `${prefix}Pending` : `${prefix}Missed`, met: false };
}

export function describeHeatmapDay(
    day: HeatmapDay,
    goal: HeatmapGoal | undefined,
    metPeriods: ReadonlySet<string>,
    formatter: Intl.DateTimeFormat,
    language: Language,
    t: Translate,
): HeatmapDayDetails {
    const goalState = goal ? describeGoal(day, goal, metPeriods) : null;
    return {
        date: formatter.format(day.date),
        entries: day.count > 0 ? pluralPhrase(t, 'statsHeatmapEntries', day.count, language) : t('statsHeatmapNoEntries'),
        words: day.words ? pluralPhrase(t, 'statsHeatmapWords', day.words, language) : null,
        goal: goalState ? t(goalState.text) : null,
        goalMet: goalState?.met ?? false,
    };
}

/** The day's accessible name: the same lines as its tooltip, as sentences. */
export function heatmapDayLabel(details: HeatmapDayDetails): string {
    return [details.date, details.entries, details.words, details.goal].filter(Boolean).join('. ');
}
