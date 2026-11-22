import { dailySchedule } from '@/modules/opt-in-email/opt-in-email-schedule';

/** The local hour the "On this day" email arrives at until the writer picks another. */
export const DEFAULT_ON_THIS_DAY_HOUR = 8;

/** Every local day at the chosen hour, at most one email a day. */
export const ON_THIS_DAY_SCHEDULE = dailySchedule(DEFAULT_ON_THIS_DAY_HOUR);
