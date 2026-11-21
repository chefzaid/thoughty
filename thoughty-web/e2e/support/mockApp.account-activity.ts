import type { components } from '../../src/generated/openapi';
import { fulfillJson, type RouteContext } from './mockApp.route-utils';

type MockAccountEvent = components['schemas']['AccountEventDto'];

/** The account activity as the API keeps it: the past year's events, newest first, and the new-browser email. */
export interface MockAccountActivityState {
  events: MockAccountEvent[];
  newBrowserEmail: boolean;
}

/** Events per page, as the API sends them. */
export const MOCK_ACCOUNT_ACTIVITY_PAGE_SIZE = 50;

/** The sign-in that opened the mock session, unless a spec passes its own events. */
export function createMockAccountActivityState(options: Partial<MockAccountActivityState> = {}): MockAccountActivityState {
  return {
    events: (options.events ?? [
      { id: 1, kind: 'sign_in', browser: 'Firefox', system: 'Windows', createdAt: '2024-04-20T08:00:00.000Z' },
    ]).map((event) => ({ ...event })),
    newBrowserEmail: options.newBrowserEmail ?? true,
  };
}

/** Records what the mock API did, as the API's account activity would, newest first. */
export function recordMockAccountEvent(state: MockAccountActivityState, kind: MockAccountEvent['kind']): void {
  const id = Math.max(0, ...state.events.map((event) => event.id)) + 1;
  state.events.unshift({ id, kind, browser: 'Chrome', system: 'Linux', createdAt: new Date().toISOString() });
}

export async function handleAccountActivityRoutes({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  const activity = state.accountActivity;
  if (pathname === '/api/auth/activity' && request.method() === 'GET') {
    const before = Number(searchParams.get('before') ?? 0);
    const older = activity.events.filter((event) => !before || event.id < before);
    const page = older.slice(0, MOCK_ACCOUNT_ACTIVITY_PAGE_SIZE);
    await fulfillJson(route, {
      events: page,
      nextBefore: older.length > MOCK_ACCOUNT_ACTIVITY_PAGE_SIZE ? page[page.length - 1]!.id : null,
      newBrowserEmail: activity.newBrowserEmail,
    });
    return true;
  }

  if (pathname === '/api/auth/activity/new-browser-email' && request.method() === 'PUT') {
    const { enabled } = request.postDataJSON() as { enabled: boolean };
    activity.newBrowserEmail = enabled;
    await fulfillJson(route, { newBrowserEmail: enabled });
    return true;
  }

  return false;
}
