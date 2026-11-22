import { dailySchedule } from '@/modules/opt-in-email/opt-in-email-schedule';

/** The local hour the writing reminder arrives at until the writer picks another: the evening, before the day is over. */
export const DEFAULT_WRITING_REMINDER_HOUR = 20;

/** Every local day at the chosen hour, at most one reminder a day. */
export const WRITING_REMINDER_SCHEDULE = dailySchedule(DEFAULT_WRITING_REMINDER_HOUR);
