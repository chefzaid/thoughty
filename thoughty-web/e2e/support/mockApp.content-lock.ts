import type { components } from '../../src/generated/openapi';
import { fulfillApiError, fulfillJson, toEntryResponse, type RouteContext } from './mockApp.route-utils';
import type { MockAppState, MockEntry } from './mockApp.shared';

/** The mock's PIN lock, as the API keeps it: one PIN, its wrong tries, and the one unlock the page holds. */
export interface MockContentLockState {
  pin: string | null;
  failedAttempts: number;
  /** Epoch milliseconds until which no PIN is accepted. */
  blockedUntil: number | null;
  token: string | null;
  unlockCount: number;
  /** Whether the request being answered carries the live unlock (set before each request is routed). */
  requestUnlocked: boolean;
  /** Every PIN sent to unlock, in order, so a spec can tell what was typed. */
  unlockAttempts: string[];
}

/** Wrong PINs before tries are blocked, as the API counts them. */
export const MOCK_FREE_PIN_ATTEMPTS = 5;
/** The mock accepts any account password but this one, to show a wrong password. */
export const MOCK_WRONG_PASSWORD = 'wrong-password';

export function createMockContentLockState(): MockContentLockState {
  return { pin: null, failedAttempts: 0, blockedUntil: null, token: null, unlockCount: 0, requestUnlocked: false, unlockAttempts: [] };
}

/** Notes, before a request is routed, whether it carries the live unlock (the `X-Content-Unlock` header). */
export function readMockUnlock({ request, state }: Pick<RouteContext, 'request' | 'state'>): void {
  const header = request.headers()['x-content-unlock'];
  state.contentLock.requestUnlocked = state.contentLock.token !== null && header === state.contentLock.token;
}

/** Whether the entry is locked, by its own flag or its diary's. */
export function isMockEntryLocked(entry: MockEntry, state: MockAppState): boolean {
  const diary = state.diaries.find((candidate) => candidate.id === (entry.diaryId ?? 1));
  return Boolean(entry.isLocked || diary?.isLocked);
}

/** Whether the API would withhold the entry from the request being answered. */
export function isMockWithheld(entry: MockEntry, state: MockAppState): boolean {
  return isMockEntryLocked(entry, state) && !state.contentLock.requestUnlocked;
}

function hasLockedContent(state: MockAppState): boolean {
  return state.diaries.some((diary) => diary.isLocked) || [...state.entries, ...state.trash].some((entry) => isMockEntryLocked(entry, state));
}

function status(state: MockAppState): components['schemas']['ContentLockStatusDto'] {
  const lock = state.contentLock;
  const blocked = lock.blockedUntil !== null && lock.blockedUntil > Date.now();
  return {
    pinSet: lock.pin !== null,
    hasLockedContent: hasLockedContent(state),
    unlocked: lock.requestUnlocked,
    unlockExpiresAt: lock.requestUnlocked ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
    attemptsLeft: Math.max(0, MOCK_FREE_PIN_ATTEMPTS - lock.failedAttempts),
    blockedUntil: blocked ? new Date(lock.blockedUntil!).toISOString() : null,
  };
}

/** Checks a PIN as the API does; answers the refusal itself and returns false when it is not the right one. */
async function checkPin({ route, state }: RouteContext, pin: string): Promise<boolean> {
  const lock = state.contentLock;
  if (lock.pin === null) {
    await fulfillApiError(route, 409, 'CONTENT_PIN_NOT_SET', 'Set a PIN in your profile first');
    return false;
  }
  if (lock.blockedUntil !== null && lock.blockedUntil > Date.now()) {
    await fulfillApiError(route, 429, 'CONTENT_PIN_BLOCKED', 'Too many wrong PINs. Try again later.');
    return false;
  }
  if (pin === lock.pin) {
    lock.failedAttempts = 0;
    lock.blockedUntil = null;
    return true;
  }
  lock.failedAttempts += 1;
  if (lock.failedAttempts >= MOCK_FREE_PIN_ATTEMPTS) {
    lock.blockedUntil = Date.now() + 60_000 * 2 ** (lock.failedAttempts - MOCK_FREE_PIN_ATTEMPTS);
    await fulfillApiError(route, 429, 'CONTENT_PIN_BLOCKED', 'Too many wrong PINs. Try again later.');
  } else {
    await fulfillApiError(route, 403, 'CONTENT_PIN_INCORRECT', 'Wrong PIN');
  }
  return false;
}

/** The proof a PIN change needs once a PIN is set: the current PIN, or the account password. */
async function checkProof(context: RouteContext, proof: components['schemas']['ContentPinProofDto']): Promise<boolean> {
  if (proof.currentPin) return checkPin(context, proof.currentPin);
  if (!proof.password) {
    await fulfillApiError(context.route, 400, 'CONTENT_PIN_PROOF_REQUIRED', 'Enter your current PIN or your account password');
    return false;
  }
  if (proof.password === MOCK_WRONG_PASSWORD) {
    await fulfillApiError(context.route, 401, 'AUTH_INVALID_PASSWORD', 'Invalid password');
    return false;
  }
  return true;
}

async function handleLockToggle(context: RouteContext): Promise<boolean> {
  const { route, request, pathname, state } = context;
  const match = /^\/api\/(entries|diaries)\/(\d+)\/lock$/.exec(pathname);
  if (!match || request.method() !== 'PATCH') return false;
  const id = Number(match[2]);
  const { locked } = request.postDataJSON() as components['schemas']['SetLockDto'];
  const target = match[1] === 'entries'
    ? state.entries.find((entry) => entry.id === id)
    : state.diaries.find((diary) => diary.id === id);
  if (!target) {
    await fulfillApiError(route, 404, match[1] === 'entries' ? 'ENTRY_NOT_FOUND' : 'DIARY_NOT_FOUND', 'Not found');
  } else if (locked && state.contentLock.pin === null) {
    await fulfillApiError(route, 409, 'CONTENT_PIN_NOT_SET', 'Set a PIN in your profile first');
  } else if (!locked && target.isLocked && !state.contentLock.requestUnlocked) {
    await fulfillApiError(route, 423, 'CONTENT_LOCKED', 'This is locked. Unlock it with your PIN.');
  } else {
    target.isLocked = locked;
    if (locked) target.visibility = 'private';
    if (match[1] === 'diaries') {
      if (locked) for (const entry of state.entries.filter((candidate) => (candidate.diaryId ?? 1) === id)) entry.visibility = 'private';
      await fulfillJson(route, target);
    } else {
      await fulfillJson(route, { success: true, entry: toEntryResponse(target as MockEntry, state) });
    }
  }
  return true;
}

/** The PIN lock routes: its state, the PIN, the unlock, and locking an entry or a diary. */
export async function handleContentLockRoutes(context: RouteContext): Promise<boolean> {
  const { route, request, pathname, state } = context;
  const lock = state.contentLock;
  const method = request.method();

  if (pathname === '/api/content-lock' && method === 'GET') {
    await fulfillJson(route, status(state));
    return true;
  }
  if (pathname === '/api/content-lock/pin' && method === 'PUT') {
    const { pin, ...proof } = request.postDataJSON() as components['schemas']['SetContentPinDto'];
    if (lock.pin === null || (await checkProof(context, proof))) {
      lock.pin = pin;
      lock.failedAttempts = 0;
      lock.blockedUntil = null;
      lock.token = null;
      await fulfillJson(route, { success: true });
    }
    return true;
  }
  if (pathname === '/api/content-lock/pin/remove' && method === 'POST') {
    if (lock.pin === null) {
      await fulfillApiError(route, 409, 'CONTENT_PIN_NOT_SET', 'Set a PIN in your profile first');
    } else if (await checkProof(context, request.postDataJSON() as components['schemas']['ContentPinProofDto'])) {
      Object.assign(lock, { pin: null, token: null, failedAttempts: 0, blockedUntil: null });
      for (const holder of [...state.diaries, ...state.entries, ...state.trash]) holder.isLocked = false;
      await fulfillJson(route, { success: true });
    }
    return true;
  }
  if (pathname === '/api/content-lock/unlock' && method === 'POST') {
    const { pin } = request.postDataJSON() as components['schemas']['UnlockContentDto'];
    lock.unlockAttempts.push(pin);
    if (await checkPin(context, pin)) {
      lock.unlockCount += 1;
      lock.token = `mock-unlock-${lock.unlockCount}`;
      await fulfillJson(route, { token: lock.token, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() });
    }
    return true;
  }
  if (pathname === '/api/content-lock/unlock' && method === 'DELETE') {
    if (lock.requestUnlocked) lock.token = null;
    await fulfillJson(route, { success: true });
    return true;
  }
  return handleLockToggle(context);
}
