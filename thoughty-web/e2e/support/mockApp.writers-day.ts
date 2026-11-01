import { recordContractViolations, writersDayPlacement } from './mockApp.contract';
import type { RouteContext } from './mockApp.route-utils';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function bodyToday(raw: string | null): unknown {
  if (!raw) return undefined;
  try {
    return (JSON.parse(raw) as { today?: unknown }).today;
  } catch {
    return undefined;
  }
}

/**
 * "Today", "this week", "this month" and "this year" are the writer's own, so the app sends its day
 * (`today`, YYYY-MM-DD) to every route that takes one; a request without it fails the test that made
 * it, as a contract break does.
 */
export function checkWritersDaySent({ request, pathname, searchParams }: RouteContext): void {
  const method = request.method();
  const placement = writersDayPlacement(method, pathname);
  if (!placement) return;
  const today = placement === 'query' ? searchParams.get('today') : bodyToday(request.postData());
  if (typeof today !== 'string' || !DAY.test(today)) {
    recordContractViolations([`${method} ${pathname} sends no writer’s day: the app sends \`today\` to every route that takes it`]);
  }
}
