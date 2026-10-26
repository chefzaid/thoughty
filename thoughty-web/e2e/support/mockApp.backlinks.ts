import { sortEntries, type MockAppState, type MockEntry } from './mockApp.shared';

// The same reference syntaxes the API's entry-references.util recognises: `[[date]]`, `[[date#n]]`
// and the legacy `entry(date)` / `entry(date--n)`. A reference without a number points at entry #1.
const REFERENCE_PATTERNS = [
  /\[\[(\d{4}-\d{2}-\d{2})(?:#(\d+))?\]\]/gi,
  /entry\s*\((\d{4}-\d{2}-\d{2})(?:--(\d+))?\)/gi,
];

function referencesEntry(content: string, target: MockEntry): boolean {
  const targetIndex = target.index || 1;
  return REFERENCE_PATTERNS.some((pattern) => [...content.matchAll(pattern)].some(
    ([, date, rawIndex]) => date === target.date && (rawIndex ? Number.parseInt(rawIndex, 10) : 1) === targetIndex,
  ));
}

/**
 * The `GET /api/entries/:id/backlinks` body: the user's other live entries that reference the
 * entry, in journal order, across every diary and archived or not. Entries in the recycle bin are
 * not in `state.entries`, so they neither have nor give backlinks, as the API's soft delete does.
 * Returns null when the entry is not in the journal (the API answers 404).
 */
export function getMockBacklinks(state: MockAppState, entryId: number) {
  const target = state.entries.find((entry) => entry.id === entryId);
  if (!target) {
    return null;
  }

  return {
    backlinks: sortEntries(state.entries)
      .filter((entry) => entry.id !== entryId && referencesEntry(entry.content, target))
      .map((entry) => {
        const diary = state.diaries.find((candidate) => candidate.id === (entry.diaryId ?? 1));
        return {
          id: entry.id,
          date: entry.date,
          index: entry.index,
          title: entry.title ?? null,
          time_of_day: entry.time_of_day ?? null,
          tags: entry.tags,
          content: entry.content,
          format: entry.format || 'plain',
          visibility: entry.visibility,
          is_favorite: entry.is_favorite ?? false,
          is_archived: entry.is_archived ?? false,
          // The mock journal has no pinning, so no entry is pinned.
          is_pinned: false,
          diary_name: diary?.name,
          diary_icon: diary?.icon,
          diary_color: diary?.color,
        };
      }),
  };
}
