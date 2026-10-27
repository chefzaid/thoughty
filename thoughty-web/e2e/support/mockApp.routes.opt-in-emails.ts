import type { components } from '../../src/generated/openapi';
import { fulfillApiError, fulfillJson, type RouteContext } from './mockApp.route-utils';
import type { MockAppState } from './mockApp.shared';

export type MockOptInEmail = components['schemas']['OptInEmailSettingsDto'];
type OptInEmailChanges = components['schemas']['UpdateOptInEmailDto'];
type OptInEmailKind = components['schemas']['EmailUnsubscribeResultDto']['kind'];

/** The only unsubscribe tokens the mock API signed: the ones in the signed-in writer's emails. */
export const MOCK_UNSUBSCRIBE_TOKENS: Record<OptInEmailKind, string> = {
  'on-this-day': '1.Xq0o2Zr4b0bq9m3xg1Vd7QF2s8kPj5tYwHn6cLzA_eE',
  'monthly-recap': 'recap.1.Rm4v0Qp8b3cL7xg1Vd7QF2s8kPj5tYwHn6cLzA_eE',
};
export const MOCK_ON_THIS_DAY_UNSUBSCRIBE_TOKEN = MOCK_UNSUBSCRIBE_TOKENS['on-this-day'];

/** Each email's settings route, the state that holds it, and how its next send comes round. */
const EMAILS: Record<OptInEmailKind, { path: string; state: 'onThisDayEmail' | 'monthlyRecapEmail'; monthly: boolean }> = {
  'on-this-day': { path: '/api/on-this-day-email', state: 'onThisDayEmail', monthly: false },
  'monthly-recap': { path: '/api/monthly-recap-email', state: 'monthlyRecapEmail', monthly: true },
};

const QUARTER_HOUR_MS = 15 * 60 * 1000;

/**
 * The next quarter hour after now at which the zone's clock reads `hour`:00 (on the 1st of a month for
 * the monthly recap), as the API schedules it.
 */
function nextSendAt(hour: number, timeZone: string, monthly: boolean): string {
  const format = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', day: 'numeric', hour: 'numeric', minute: 'numeric' });
  let candidate = Math.ceil((Date.now() + 1) / QUARTER_HOUR_MS) * QUARTER_HOUR_MS;
  for (let step = 0; step < 4 * 24 * 32; step++, candidate += QUARTER_HOUR_MS) {
    const parts = format.formatToParts(new Date(candidate));
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    if (value('hour') === hour && value('minute') === 0 && (!monthly || value('day') === 1)) return new Date(candidate).toISOString();
  }
  return new Date(candidate).toISOString();
}

export function createMockOptInEmail(overrides: Partial<MockOptInEmail> = {}): MockOptInEmail {
  return { enabled: false, deliveryHour: 8, timeZone: null, diaryId: null, nextSendAt: null, emailAvailable: true, ...overrides };
}

function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

function turnOff(state: MockAppState, kind: OptInEmailKind) {
  const key = EMAILS[kind].state;
  state[key] = { ...state[key], enabled: false, nextSendAt: null };
}

/**
 * The opt-in emails as the API answers them: `/api/on-this-day-email` and `/api/monthly-recap-email`
 * (one setting per writer) and the shared signed unsubscribe link the unsubscribe page posts to.
 */
export async function handleOptInEmailRoutes({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/email-unsubscribe' && request.method() === 'POST') {
    const kind = (Object.keys(MOCK_UNSUBSCRIBE_TOKENS) as OptInEmailKind[]).find((candidate) => MOCK_UNSUBSCRIBE_TOKENS[candidate] === searchParams.get('token'));
    if (!kind) {
      await fulfillApiError(route, 400, 'EMAIL_UNSUBSCRIBE_INVALID', 'This unsubscribe link is not valid');
      return true;
    }
    turnOff(state, kind);
    await fulfillJson(route, { success: true, kind });
    return true;
  }

  const email = Object.values(EMAILS).find((candidate) => candidate.path === pathname);
  if (!email) return false;

  if (request.method() === 'GET') {
    await fulfillJson(route, state[email.state]);
    return true;
  }

  if (request.method() === 'PUT') {
    const changes = request.postDataJSON() as OptInEmailChanges;
    if (!isTimeZone(changes.timeZone)) {
      await fulfillApiError(route, 400, 'VALIDATION_FAILED', 'Unknown time zone');
      return true;
    }
    if (changes.diaryId !== null && !state.diaries.some((diary) => diary.id === changes.diaryId)) {
      await fulfillApiError(route, 404, 'DIARY_NOT_FOUND', 'Diary not found');
      return true;
    }
    state[email.state] = {
      ...state[email.state],
      ...changes,
      nextSendAt: changes.enabled ? nextSendAt(changes.deliveryHour, changes.timeZone, email.monthly) : null,
    };
    await fulfillJson(route, state[email.state]);
    return true;
  }

  return false;
}
