import { normalizeEntryTitle, normalizeTimeOfDay } from './entry-order.util';
import { normalizeFeelings, normalizeMood } from './entry-mood.util';
import { type EntryData, normalizeEntryDate, sealedUntilText, sortEntries } from './file-converter-entry.util';

function escapeCsvCell(value: string | number | undefined): string {
  const serialized = value === undefined ? '' : String(value);
  return /[",\r\n]/.test(serialized)
    ? `"${serialized.replaceAll('"', '""')}"`
    : serialized;
}

function countWords(content: string): number {
  const trimmed = content.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Generate CSV export content from entries with per-entry metrics.
 */
export function generateCsvFile(entries: EntryData[], includeVisibility = false): string {
  const sorted = sortEntries(entries);
  // The column only appears when a sealed time capsule is in the file
  const includeSealed = sorted.some((entry) => entry.sealedUntil);
  const headers = [
    'date',
    'index',
    'time',
    'title',
    'mood',
    'feelings',
    'diary',
    'tags',
    ...(includeVisibility ? ['visibility'] : []),
    ...(includeSealed ? ['sealed_until'] : []),
    'format',
    'word_count',
    'reading_time_minutes',
    'content',
  ];

  const rows = sorted.map((entry) => {
    const content = entry.content || '';
    const wordCount = countWords(content);
    const readingTimeMinutes = wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 200)) : 0;
    return [
      normalizeEntryDate(entry.date),
      entry.index,
      normalizeTimeOfDay(entry.timeOfDay) ?? undefined,
      normalizeEntryTitle(entry.title) ?? undefined,
      normalizeMood(entry.mood) ?? undefined,
      normalizeFeelings(entry.feelings).join(';'),
      entry.diaryName,
      (entry.tags || []).join(';'),
      ...(includeVisibility ? [entry.visibility || 'private'] : []),
      ...(includeSealed ? [sealedUntilText(entry) ?? undefined] : []),
      entry.format || 'plain',
      wordCount,
      readingTimeMinutes,
      content,
    ].map(escapeCsvCell).join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}
