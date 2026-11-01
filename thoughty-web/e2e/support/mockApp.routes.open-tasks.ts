import { isMockSealed } from './mockApp.routes.time-capsules';
import { fulfillApiError, fulfillJson, type RouteContext } from './mockApp.route-utils';
import { sortEntries, type MockEntry } from './mockApp.shared';

/** An unticked task list item: the marker (in a quote or nested), an empty box, then its text. */
const OPEN_TASK_LINE = /^(?:[\t ]*>)*[\t ]{0,3}(?:[*+-]|\d{1,9}[.)])[\t ]+\[ \][\t ]+(\S.*?)\s*$/;
const NESTED_OPEN_TASK_LINE = /^(?:[\t ]*>)*[\t ]+(?:[*+-]|\d{1,9}[.)])[\t ]+\[ \][\t ]+(\S.*?)\s*$/;
const FENCE = /^[\t ]{0,3}(`{3,}|~{3,})/;

/**
 * The unticked tasks of an entry as the API reads them, for the cases the specs write: list markers, nested
 * items, quotes and fenced code (left out). The API itself follows CommonMark's whole block structure.
 */
export function mockOpenTasks(content: string): Array<{ line: number; text: string }> {
  const tasks: Array<{ line: number; text: string }> = [];
  let fence: string | null = null;
  content.split('\n').forEach((text, line) => {
    const opening = FENCE.exec(text)?.[1];
    if (fence) {
      if (opening?.startsWith(fence)) fence = null;
      return;
    }
    if (opening) {
      fence = opening[0].repeat(3);
      return;
    }
    const match = OPEN_TASK_LINE.exec(text) ?? NESTED_OPEN_TASK_LINE.exec(text);
    if (match?.[1]) tasks.push({ line, text: match[1] });
  });
  return tasks;
}

/** Where a task stands, as the API's cursor writes it: entry date, time of day, same-day order, id and line. */
type TaskPosition = [date: string, time: string, index: number, id: number, line: number];
const CURSOR = /^(\d{4}-\d{2}-\d{2})_(\d{2}:\d{2})?_(\d{1,10})_(\d{1,10})_(\d{1,7})$/;

const parseCursor = (cursor: string): TaskPosition | null => {
  const match = CURSOR.exec(cursor);
  return match ? [match[1]!, match[2] ?? '', Number(match[3]), Number(match[4]), Number(match[5])] : null;
};

/** Negative when `a` comes first: newest date first, then the rest ascending, as the API orders tasks. */
const comparePositions = (a: TaskPosition, b: TaskPosition): number => {
  if (a[0] !== b[0]) return b[0].localeCompare(a[0]);
  if (a[1] !== b[1]) return a[1].localeCompare(b[1]);
  return a[2] - b[2] || a[3] - b[3] || a[4] - b[4];
};

const positiveInt = (value: string | null): number | null => {
  if (value === null) return null;
  return /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : Number.NaN;
};

/** `GET /api/entries/open-tasks`: the unticked tasks of the writer's Markdown entries, newest first, paged. */
export async function handleOpenTaskRoutes({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname !== '/api/entries/open-tasks' || request.method() !== 'GET') {
    return false;
  }

  const page = positiveInt(searchParams.get('page')) ?? 1;
  const limit = positiveInt(searchParams.get('limit')) ?? 50;
  const diaryId = positiveInt(searchParams.get('diaryId'));
  const afterParam = searchParams.get('after');
  const after = afterParam === null ? null : parseCursor(afterParam);
  if (Number.isNaN(page) || Number.isNaN(limit) || Number.isNaN(diaryId) || limit > 100 || (afterParam !== null && !after)) {
    await fulfillApiError(route, 400, 'VALIDATION_FAILED', 'The diary, page, page size or cursor is invalid');
    return true;
  }

  const inScope = (entry: MockEntry) => entry.format === 'markdown' && !isMockSealed(entry)
    && (diaryId === null || (entry.diaryId ?? 1) === diaryId);
  const entries = sortEntries(state.entries.filter(inScope));
  const tasks = entries.flatMap((entry) => mockOpenTasks(entry.content).map((task) => ({
    position: [entry.date, entry.time_of_day || '', entry.index, entry.id, task.line] as TaskPosition,
    task: { entryId: entry.id, date: entry.date, title: entry.title ?? null, ...task },
  })));

  // With a cursor the page starts right after it, so tasks ticked on the page before skip none
  const before = after ? tasks.filter(({ position }) => comparePositions(position, after) <= 0).length : 0;
  const start = after ? before : (page - 1) * limit;
  const shown = tasks.slice(start, start + limit);
  const last = shown.at(-1);
  const pagesBefore = Math.ceil(before / limit);
  await fulfillJson(route, {
    tasks: shown.map(({ task }) => task),
    total: tasks.length,
    page: after ? pagesBefore + 1 : page,
    totalPages: after ? pagesBefore + Math.ceil((tasks.length - before) / limit) : Math.ceil(tasks.length / limit),
    nextCursor: last && start + shown.length < tasks.length ? last.position.join('_') : null,
  });
  return true;
}
