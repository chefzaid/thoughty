import { BadRequestException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { latestDayOnEarth } from './person-dates';

/**
 * How often the writer can ask to be reminded to reach out to someone, in days: every two weeks, month,
 * two months, three months, six months or year.
 */
export const REACH_OUT_DAYS = [14, 30, 60, 90, 180, 365] as const;

/** The most people Highlights lists as due a reach-out, the longest out of touch first. */
export const REACH_OUT_HIGHLIGHTS_LIMIT = 10;

/** Refuses a last contact on a day that has not come yet anywhere on Earth (`PERSON_CONTACT_IN_FUTURE`). */
export function assertValidContactDay(day: string, now = new Date()): void {
  if (day > latestDayOnEarth(now)) {
    throw apiError(BadRequestException, 'PERSON_CONTACT_IN_FUTURE');
  }
}
