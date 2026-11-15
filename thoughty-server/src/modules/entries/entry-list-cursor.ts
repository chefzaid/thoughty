/**
 * Where an entry stands in the journal list, written as a cursor the next or previous batch starts from.
 *
 * The cursor holds the sort values themselves rather than an offset or an entry ID, so a batch keeps its
 * place when entries are written, deleted or moved while the writer scrolls: nothing is skipped or shown
 * twice. The first value (`lead`) is what the list sorts by first, as an ascending number: 0 for a pinned
 * entry and 1 for the others in date order, the search rank negated in relevance order, and the place
 * among the given IDs for a meaning search. Then come the date, time of day, same-day order and ID.
 */
export interface EntryListPosition {
  lead: number;
  date: string;
  timeOfDay: string | null;
  index: number;
  id: number;
}

/** `lead_date_timeOfDay_index_id`, the time of day empty when the entry has none. */
export const ENTRY_LIST_CURSOR_PATTERN =
  /^(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)_(\d{4}-\d{2}-\d{2})_(\d{2}:\d{2})?_(\d{1,10})_(\d{1,10})$/;

export function formatEntryListCursor(position: EntryListPosition): string {
  return [String(position.lead), position.date, position.timeOfDay ?? '', position.index, position.id].join('_');
}

/** The position a cursor names; the DTO checks its shape before it gets here. */
export function parseEntryListCursor(cursor: string): EntryListPosition {
  const match = ENTRY_LIST_CURSOR_PATTERN.exec(cursor);
  if (!match) {
    throw new Error('Invalid entry list cursor');
  }
  const [, lead, date, timeOfDay, index, id] = match;
  return { lead: Number(lead), date, timeOfDay: timeOfDay ?? null, index: Number(index), id: Number(id) };
}

/**
 * The list's sort key as a row of ascending values, so one row comparison finds the entries before or
 * after a position: the lead, the date newest first (days before 1970 counted down), entries without a
 * time of day first, then by time, same-day order and ID. `lead` is the SQL of the first value.
 */
export function entryListKey(lead: string): string {
  return `(CAST(${lead} AS double precision), DATE '1970-01-01' - e.date, e.time_of_day IS NOT NULL, `
    + "COALESCE(e.time_of_day, TIME '00:00'), e.index, e.id)";
}

/** The same row for a cursor's position, read from the parameters `entryListCursorParameters` names. */
export const ENTRY_LIST_CURSOR_KEY =
  "(CAST(:cursorLead AS double precision), DATE '1970-01-01' - CAST(:cursorDate AS date), "
  + "CAST(:cursorTimed AS boolean), COALESCE(CAST(:cursorTime AS time), TIME '00:00'), "
  + 'CAST(:cursorIndex AS integer), CAST(:cursorId AS integer))';

export function entryListCursorParameters(position: EntryListPosition): Record<string, unknown> {
  return {
    cursorLead: position.lead,
    cursorDate: position.date,
    cursorTimed: position.timeOfDay !== null,
    cursorTime: position.timeOfDay,
    cursorIndex: position.index,
    cursorId: position.id,
  };
}
