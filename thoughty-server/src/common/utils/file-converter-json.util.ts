import { normalizeEntryTitle, normalizeTimeOfDay } from './entry-order.util';
import {
  type EntryData,
  moodFields,
  normalizeEntryDate,
  type ParsedEntry,
  sortEntries,
} from './file-converter-entry.util';

/**
 * Generate JSON export content from entries
 */
export function generateJsonFile(entries: EntryData[], includeVisibility = false): string {
  const sorted = sortEntries(entries);

  const exportEntries = sorted.map((entry) => {
    const title = normalizeEntryTitle(entry.title);
    const time = normalizeTimeOfDay(entry.timeOfDay);
    const obj: Record<string, unknown> = {
      date: normalizeEntryDate(entry.date),
      index: entry.index,
      ...(time && { time }),
      ...(title && { title }),
      ...moodFields(entry.mood, entry.feelings),
      tags: entry.tags || [],
      content: entry.content || '',
      format: entry.format || 'plain',
    };
    if (includeVisibility) {
      obj.visibility = entry.visibility || 'private';
    }
    if (entry.diaryName) {
      obj.diary = entry.diaryName;
    }
    return obj;
  });

  return JSON.stringify({ entries: exportEntries }, null, 2);
}

/**
 * Parse JSON file content into entry objects
 */
export function parseJsonFile(content: string): ParsedEntry[] {
  const data = JSON.parse(content);
  const rawEntries = Array.isArray(data) ? data : data.entries;

  if (!Array.isArray(rawEntries)) {
    return [];
  }

  return rawEntries
    .filter((e: Record<string, unknown>): e is Record<string, unknown> & { date: string; content: string } =>
      typeof e.date === 'string' && e.date.length > 0 && typeof e.content === 'string' && e.content.trim().length > 0
    )
    .map((e: Record<string, unknown> & { date: string; content: string }) => {
      const entry: ParsedEntry = {
        date: e.date.split('T')[0],
        index: typeof e.index === 'number' ? e.index : 1,
        tags: Array.isArray(e.tags) ? (e.tags as string[]).map(String) : [],
        content: e.content.trim(),
        format: e.format === 'markdown' ? 'markdown' : 'plain',
      };
      const title = typeof e.title === 'string' ? normalizeEntryTitle(e.title) : null;
      if (title) {
        entry.title = title;
      }
      const time = typeof e.time === 'string' ? normalizeTimeOfDay(e.time) : null;
      if (time) {
        entry.timeOfDay = time;
      }
      Object.assign(entry, moodFields(e.mood, e.feelings));
      if (e.visibility === 'public' || e.visibility === 'private') {
        entry.visibility = e.visibility;
      }
      if (typeof e.diary === 'string' && e.diary.trim()) {
        entry.diaryName = e.diary.trim();
      }
      return entry;
    });
}
