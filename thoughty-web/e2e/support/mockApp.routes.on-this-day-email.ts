import type { components } from '../../src/generated/openapi';
import { fulfillApiError, fulfillJson, type RouteContext } from './mockApp.route-utils';

export type MockOnThisDayEmail = components['schemas']['OnThisDayEmailSettingsDto'];
type OnThisDayEmailChanges = components['schemas']['UpdateOnThisDayEmailDto'];

/** The only unsubscribe token the mock API signed: the one in the signed-in writer's emails. */
export const MOCK_ON_THIS_DAY_UNSUBSCRIBE_TOKEN = '1.Xq0o2Zr4b0bq9m3xg1Vd7QF2s8kPj5tYwHn6cLzA_eE';

const QUARTER_HOUR_MS = 15 * 60 * 1000;

/** The next quarter hour after now at which the zone's clock reads `hour`:00, as the API schedules it. */
function nextSendAt(hour: number, timeZone: string): string {
  const format = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', hour: 'numeric', minute: 'numeric' });
  let candidate = Math.ceil((Date.now() + 1) / QUARTER_HOUR_MS) * QUARTER_HOUR_MS;
  for (let step = 0; step < 4 * 48; step++, candidate += QUARTER_HOUR_MS) {
    const parts = format.formatToParts(new Date(candidate));
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    if (value('hour') === hour && value('minute') === 0) return new Date(candidate).toISOString();
  }
  return new Date(candidate).toISOString();
}

export function createMockOnThisDayEmail(overrides: Partial<MockOnThisDayEmail> = {}): MockOnThisDayEmail {
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

/** `/api/on-this-day-email` as the API answers it: one setting per writer, and its signed unsubscribe link. */
export async function handleOnThisDayEmailRoutes({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/on-this-day-email/unsubscribe' && request.method() === 'POST') {
    if (searchParams.get('token') !== MOCK_ON_THIS_DAY_UNSUBSCRIBE_TOKEN) {
      await fulfillApiError(route, 400, 'ON_THIS_DAY_UNSUBSCRIBE_INVALID', 'This unsubscribe link is not valid');
      return true;
    }
    state.onThisDayEmail = { ...state.onThisDayEmail, enabled: false, nextSendAt: null };
    await fulfillJson(route, { success: true });
    return true;
  }

  if (pathname !== '/api/on-this-day-email') return false;

  if (request.method() === 'GET') {
    await fulfillJson(route, state.onThisDayEmail);
    return true;
  }

  if (request.method() === 'PUT') {
    const changes = request.postDataJSON() as OnThisDayEmailChanges;
    if (!isTimeZone(changes.timeZone)) {
      await fulfillApiError(route, 400, 'VALIDATION_FAILED', 'Unknown time zone');
      return true;
    }
    if (changes.diaryId !== null && !state.diaries.some((diary) => diary.id === changes.diaryId)) {
      await fulfillApiError(route, 404, 'DIARY_NOT_FOUND', 'Diary not found');
      return true;
    }
    state.onThisDayEmail = {
      ...state.onThisDayEmail,
      ...changes,
      nextSendAt: changes.enabled ? nextSendAt(changes.deliveryHour, changes.timeZone) : null,
    };
    await fulfillJson(route, state.onThisDayEmail);
    return true;
  }

  return false;
}

