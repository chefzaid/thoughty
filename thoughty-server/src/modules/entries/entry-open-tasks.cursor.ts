/**
 * Where a task stands in the list of open tasks, written as a cursor the next page starts after.
 *
 * The cursor holds the sort values themselves (entry date, time of day, same-day order, id, then the
 * task's line) rather than an offset or an entry id, so it keeps its place when tasks before it are
 * ticked, or when its own entry has no open task left and drops out of the list.
 */
export interface OpenTaskPosition {
  date: string;
  timeOfDay: string | null;
  index: number;
  id: number;
  line: number;
}

/** `date_timeOfDay_index_id_line`, the time of day empty when the entry has none. */
export const OPEN_TASK_CURSOR_PATTERN = /^(\d{4}-\d{2}-\d{2})_(\d{2}:\d{2})?_(\d{1,10})_(\d{1,10})_(\d{1,7})$/;

export function formatOpenTaskCursor(position: OpenTaskPosition): string {
  return [position.date, position.timeOfDay ?? '', position.index, position.id, position.line].join('_');
}

/** The position a cursor names; the DTO checks its shape before it gets here. */
export function parseOpenTaskCursor(cursor: string): OpenTaskPosition {
  const match = OPEN_TASK_CURSOR_PATTERN.exec(cursor);
  if (!match) {
    throw new Error('Invalid open task cursor');
  }
  const [, date, timeOfDay, index, id, line] = match;
  return { date, timeOfDay: timeOfDay ?? null, index: Number(index), id: Number(id), line: Number(line) };
}

const ascending = (a: string | number, b: string | number): number => {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
};

/**
 * Negative when `a` comes before `b` in the list, in the journal's order: newest date first, then
 * entries without a time of day, then by time, same-day order and id, and top to bottom in an entry.
 */
export function compareOpenTaskPositions(a: OpenTaskPosition, b: OpenTaskPosition): number {
  // No time of day reads as '', which sorts before every `HH:MM`, as NULLS FIRST does in the query
  return ascending(b.date, a.date)
    || ascending(a.timeOfDay ?? '', b.timeOfDay ?? '')
    || ascending(a.index, b.index)
    || ascending(a.id, b.id)
    || ascending(a.line, b.line);
}
