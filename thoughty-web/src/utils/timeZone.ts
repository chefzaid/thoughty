/** The browser's IANA time zone, or UTC when it cannot tell. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Every IANA time zone the browser knows, sorted, always including `current`. */
export function timeZoneOptions(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = [];
  }
  return [...new Set([...zones, 'UTC', current])].sort((left, right) => left.localeCompare(right));
}

/** The 24 hours of the day a scheduled email can arrive at. */
export const DELIVERY_HOURS: readonly number[] = Array.from({ length: 24 }, (_, hour) => hour);

/** An hour of the day as the language writes it on a clock (8:00 PM, 20:00). */
export function formatDeliveryHour(hour: number, language: string): string {
  return new Intl.DateTimeFormat(language, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2000, 0, 1, hour)));
}
