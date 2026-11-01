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
  if (Number.isNaN(page) || Number.isNaN(limit) || Number.isNaN(diaryId) || limit > 100) {
    await fulfillApiError(route, 400, 'VALIDATION_FAILED', 'The diary, page or page size is invalid');
    return true;
  }

  const inScope = (entry: MockEntry) => entry.format === 'markdown' && !isMockSealed(entry)
    && (diaryId === null || (entry.diaryId ?? 1) === diaryId);
  const entries = sortEntries(state.entries.filter(inScope));
  const tasks = entries.flatMap((entry) => mockOpenTasks(entry.content).map((task) => ({
    entryId: entry.id,
    date: entry.date,
    title: entry.title ?? null,
    ...task,
  })));

  await fulfillJson(route, {
    tasks: tasks.slice((page - 1) * limit, page * limit),
    total: tasks.length,
    page,
    totalPages: Math.ceil(tasks.length / limit),
  });
  return true;
}
