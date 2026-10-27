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
