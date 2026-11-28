import { MAX_LOCATION_NAME_LENGTH } from '../../../utils/entryLocation';
import type { ImportedLocation } from './appImportTypes';

function coordinate(value: unknown, limit: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
}

/**
 * The place a source app gave an entry: its name parts without blanks or repeats (`Café de Flore, Paris, France`)
 * and its coordinates when both are within range. Journey writes its largest double for "no place", which is
 * out of range. Undefined when neither a name nor coordinates remain.
 */
export function importedLocation(nameParts: readonly unknown[], latitude: unknown, longitude: unknown): ImportedLocation | undefined {
  const parts = nameParts
    .map((part) => (typeof part === 'string' ? part.replaceAll(/\s+/g, ' ').trim() : ''))
    .filter((part, index, all) => part !== '' && all.indexOf(part) === index);
  const name = parts.join(', ').slice(0, MAX_LOCATION_NAME_LENGTH);
  const lat = coordinate(latitude, 90);
  const lon = coordinate(longitude, 180);
  const paired = lat !== null && lon !== null;
  if (!name && !paired) return undefined;
  return { ...(name ? { name } : {}), ...(paired ? { latitude: lat, longitude: lon } : {}) };
}
