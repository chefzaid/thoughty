import { formatEntryDate } from '../../utils/entryDate';

/** How long a new link lasts: one of the presets, or until the end of a day the writer picks. */
export type ShareLinkExpiryChoice = 'day' | 'week' | 'month' | 'custom';

export const SHARE_LINK_EXPIRY_CHOICES: ReadonlyArray<{ value: ShareLinkExpiryChoice; labelKey: string }> = [
  { value: 'day', labelKey: 'shareLinkExpiryDay' },
  { value: 'week', labelKey: 'shareLinkExpiryWeek' },
  { value: 'month', labelKey: 'shareLinkExpiryMonth' },
  { value: 'custom', labelKey: 'shareLinkExpiryCustom' },
];

const PRESET_DAYS: Record<Exclude<ShareLinkExpiryChoice, 'custom'>, number> = { day: 1, week: 7, month: 30 };
/** The furthest day a link can last to; the API allows a year and a day, so the end of that day always fits. */
export const SHARE_LINK_MAX_CUSTOM_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The days the date picker offers, as `YYYY-MM-DD` in the writer's time zone: tomorrow to a year from today. */
export function customExpiryBounds(now: Date = new Date()): { min: string; max: string } {
  const day = (offset: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    return formatEntryDate(date);
  };
  return { min: day(1), max: day(SHARE_LINK_MAX_CUSTOM_DAYS) };
}

/**
 * When the link expires, as the API takes it: a preset counted from now, or the last minute of the
 * picked day in the writer's time zone. Null when the picked day is missing or outside the bounds.
 */
export function shareLinkExpiresAt(choice: ShareLinkExpiryChoice, customDate: string, now: Date = new Date()): string | null {
  if (choice !== 'custom') {
    return new Date(now.getTime() + PRESET_DAYS[choice] * DAY_MS).toISOString();
  }
  const { min, max } = customExpiryBounds(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(customDate) || customDate < min || customDate > max) {
    return null;
  }
  const [year, month, day] = customDate.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, day, 23, 59, 0, 0).toISOString();
}
