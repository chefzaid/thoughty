import type { Config } from '../types';
import type { User } from './authTypes';

/**
 * What this browser remembers of the last writer signed in here, so the journal still opens when Thoughty
 * cannot be reached (no connection, or the API down): who they are, without the avatar, and how the app
 * looks and reads for them. Nothing private beyond that: no token, no entry, no profile text. It goes with
 * every session that ends (`forgetOfflineSession`), and a session the server refuses on return ends there.
 */
const USER_KEY = 'thoughty.offlineUser';
const DISPLAY_KEY = 'thoughty.offlineDisplay';
const SIGN_OUT_KEY = 'thoughty.signOutPending';

/** The settings that change how the app looks and reads, kept for the journal opened offline. */
export const OFFLINE_DISPLAY_KEYS = [
  'language',
  'theme',
  'highContrast',
  'fontFamily',
  'fontSize',
  'fontColor',
  'lineSpacing',
  'letterSpacing',
  'quietMode',
] as const satisfies ReadonlyArray<keyof Config>;

export type OfflineDisplay = Pick<Config, (typeof OFFLINE_DISPLAY_KEYS)[number]>;

const AUTH_PROVIDERS: ReadonlyArray<User['authProvider']> = ['local', 'google', 'keycloak'];

function isRememberedUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;
  const user = value as Record<string, unknown>;
  return typeof user.id === 'number' && Number.isInteger(user.id)
    && typeof user.email === 'string'
    && typeof user.username === 'string'
    && AUTH_PROVIDERS.includes(user.authProvider as User['authProvider'])
    && typeof user.emailVerified === 'boolean'
    && typeof user.twoFactorEnabled === 'boolean';
}

function read(key: string): unknown {
  try {
    const stored = globalThis.localStorage?.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the journal then needs a connection to open, as before
  }
}

export function rememberOfflineUser(user: User): void {
  const { id, email, username, authProvider, emailVerified, twoFactorEnabled } = user;
  write(USER_KEY, { id, email, username, authProvider, emailVerified, twoFactorEnabled });
}

/** The writer last signed in on this browser, or null when there is none or it cannot be read. */
export function readOfflineUser(): User | null {
  const stored = read(USER_KEY);
  return isRememberedUser(stored) ? stored : null;
}

export function rememberOfflineDisplay(config: Config): void {
  const display: OfflineDisplay = {};
  for (const key of OFFLINE_DISPLAY_KEYS) {
    if (config[key] !== undefined) Object.assign(display, { [key]: config[key] });
  }
  write(DISPLAY_KEY, display);
}

/** How the app looked for that writer, or null when nothing was kept. Only the known keys come back. */
export function readOfflineDisplay(): OfflineDisplay | null {
  const stored = read(DISPLAY_KEY);
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return null;
  const display: OfflineDisplay = {};
  for (const key of OFFLINE_DISPLAY_KEYS) {
    const value = (stored as Record<string, unknown>)[key];
    if (['string', 'number', 'boolean'].includes(typeof value)) Object.assign(display, { [key]: value });
  }
  return display;
}

/** Forgets the writer and their look, as their session ends. */
export function forgetOfflineSession(): void {
  try {
    globalThis.localStorage?.removeItem(USER_KEY);
    globalThis.localStorage?.removeItem(DISPLAY_KEY);
  } catch {
    // Nothing to remove when storage is blocked
  }
}

/**
 * A sign-out the server never heard (chosen offline, or while the API was down) is kept, so the next load
 * sends it before anything else and the refresh cookie cannot sign the writer back in.
 */
export function markSignOutPending(): void {
  write(SIGN_OUT_KEY, true);
}

export function isSignOutPending(): boolean {
  return read(SIGN_OUT_KEY) === true;
}

export function clearSignOutPending(): void {
  try {
    globalThis.localStorage?.removeItem(SIGN_OUT_KEY);
  } catch {
    // Nothing to remove when storage is blocked
  }
}
