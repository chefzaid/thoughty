/** The mood scale runs from 1 (very low) to 5 (very good). */
export const MIN_MOOD = 1;
export const MAX_MOOD = 5;

/** At most this many feeling words per entry, each one at most this long. */
export const MAX_FEELINGS = 10;
export const MAX_FEELING_LENGTH = 40;

/**
 * Characters that separate or delimit values in the text formats (TXT headers, Markdown metadata,
 * CSV cells, front matter lists), so a feeling word never holds one.
 */
const FEELING_DELIMITERS = /[,;|{}[\]`"]/g;

/** A mood level from 1 to 5, or null for anything else (including 0, decimals, and text). */
export function normalizeMood(value: unknown): number | null {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value.trim()) : value;
  return typeof parsed === 'number' && Number.isInteger(parsed) && parsed >= MIN_MOOD && parsed <= MAX_MOOD ? parsed : null;
}

/** One feeling word: on one line, lowercase, without delimiters, within the length limit; null when nothing is left. */
export function normalizeFeeling(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const cleaned = value
    .replaceAll(FEELING_DELIMITERS, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase()
    .slice(0, MAX_FEELING_LENGTH)
    .trim();
  return cleaned || null;
}

/**
 * Feeling words from a list (or a comma-separated string, as the text formats write them): each
 * one cleaned, duplicates and empty ones dropped, at most ten, in the order given.
 */
export function normalizeFeelings(value: unknown): string[] {
  const items = typeof value === 'string' ? value.split(',') : value;
  if (!Array.isArray(items)) {
    return [];
  }
  const feelings: string[] = [];
  for (const item of items) {
    const feeling = normalizeFeeling(item);
    if (feeling && !feelings.includes(feeling)) {
      feelings.push(feeling);
    }
    if (feelings.length === MAX_FEELINGS) {
      break;
    }
  }
  return feelings;
}
