import type { EntryLocation, TranslationFunction } from '../types';
import type { components } from '../generated/openapi';

/** The longest place name an entry keeps, as the API checks it. */
export const MAX_LOCATION_NAME_LENGTH = 200;

/** A place being written in the composer or the editor: the name as typed, and coordinates when the device gave them. */
export interface EntryLocationDraft {
  readonly name: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export const NO_LOCATION: EntryLocationDraft = { name: '', latitude: null, longitude: null };

export function hasCoordinates(location: Pick<EntryLocationDraft, 'latitude' | 'longitude'> | null | undefined): boolean {
  return typeof location?.latitude === 'number' && typeof location.longitude === 'number';
}

/** Whether the draft holds a place: a name that is not blank, or coordinates. */
export function isLocationSet(location: EntryLocationDraft): boolean {
  return location.name.trim() !== '' || hasCoordinates(location);
}

/** The draft for an entry's saved place, empty without one. */
export function locationDraft(location: EntryLocation | null | undefined): EntryLocationDraft {
  if (!location) return NO_LOCATION;
  return hasCoordinates(location)
    ? { name: location.name ?? '', latitude: location.latitude, longitude: location.longitude }
    : { name: location.name ?? '', latitude: null, longitude: null };
}

/** What a save sends: the place, or null to have none. */
export function locationPayload(location: EntryLocationDraft): components['schemas']['EntryLocationDto'] | null {
  if (!isLocationSet(location)) return null;
  const name = location.name.replaceAll(/\s+/g, ' ').trim();
  return {
    name: name === '' ? null : name,
    ...(hasCoordinates(location) ? { latitude: location.latitude, longitude: location.longitude } : {}),
  };
}

function coordinate(value: number, positive: string, negative: string, language: string): string {
  const degrees = new Intl.NumberFormat(language, { maximumFractionDigits: 4 }).format(Math.abs(value));
  return `${degrees}° ${value < 0 ? negative : positive}`;
}

/** Coordinates as a reader expects them, `48.8462° N, 2.3372° E`, in the app language's numbers and letters. */
export function formatCoordinates(latitude: number, longitude: number, language: string, t: TranslationFunction): string {
  return [
    coordinate(latitude, t('entryLocationNorth'), t('entryLocationSouth'), language),
    coordinate(longitude, t('entryLocationEast'), t('entryLocationWest'), language),
  ].join(', ');
}

/** How an entry shows its place: the name the writer gave it, else its coordinates; null without a place. */
export function locationLabel(location: EntryLocation | null | undefined, language: string, t: TranslationFunction): string | null {
  const name = location?.name?.trim();
  if (name) return name;
  return location && hasCoordinates(location)
    ? formatCoordinates(location.latitude as number, location.longitude as number, language, t)
    : null;
}
