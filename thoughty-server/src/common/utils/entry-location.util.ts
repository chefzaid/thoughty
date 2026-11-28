/** The longest place name an entry keeps. */
export const MAX_LOCATION_NAME_LENGTH = 200;

/** Decimal places kept on a coordinate: six is about ten centimeters, more than any browser or app measures. */
const COORDINATE_DECIMALS = 6;

/** An entry's place as the API and the JSON export write it: a name, coordinates, or both. */
export interface EntryLocation {
  name: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** The entry columns that hold its place. */
export interface EntryLocationColumns {
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
}

const NO_LOCATION_COLUMNS: EntryLocationColumns = { locationName: null, latitude: null, longitude: null };

function coordinate(value: unknown, limit: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit) {
    return null;
  }
  return Number(value.toFixed(COORDINATE_DECIMALS));
}

/**
 * A place as it was given (in a request, a file or an app import): its name on one line within the limit,
 * and its coordinates only when both are numbers within their range (an app's placeholder for "none", such as
 * Journey's largest double, is no place). Null when neither a name nor coordinates remain.
 */
export function normalizeEntryLocation(value: unknown): EntryLocation | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const given = value as Record<string, unknown>;
  const name = typeof given.name === 'string'
    ? given.name.replaceAll(/\s+/g, ' ').trim().slice(0, MAX_LOCATION_NAME_LENGTH) || null
    : null;
  const latitude = coordinate(given.latitude, 90);
  const longitude = coordinate(given.longitude, 180);
  const hasCoordinates = latitude !== null && longitude !== null;
  if (!name && !hasCoordinates) {
    return null;
  }
  return { name, latitude: hasCoordinates ? latitude : null, longitude: hasCoordinates ? longitude : null };
}

/** The columns an entry stores for a place given in any shape; all null for none. */
export function entryLocationColumns(value: unknown): EntryLocationColumns {
  const location = normalizeEntryLocation(value);
  return location
    ? { locationName: location.name, latitude: location.latitude, longitude: location.longitude }
    : { ...NO_LOCATION_COLUMNS };
}

/** The place an entry's columns hold, or null when it has none. */
export function entryLocationOf(entry: Partial<EntryLocationColumns>): EntryLocation | null {
  return normalizeEntryLocation({ name: entry.locationName, latitude: entry.latitude, longitude: entry.longitude });
}
