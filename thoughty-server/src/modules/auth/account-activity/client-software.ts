import { AsyncLocalStorage } from 'node:async_hooks';

/** The browser and system a request came from, by name only (no version), or null when unknown. */
export interface ClientSoftware {
  readonly browser: string | null;
  readonly system: string | null;
}

export const UNKNOWN_SOFTWARE: ClientSoftware = { browser: null, system: null };

/** Checked in order: browsers built on another one name themselves before it (Edge and Opera before Chrome). */
const BROWSERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bEdg(?:e|A|iOS)?\//, 'Edge'],
  [/\bOPR\/|\bOpera\b/, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\bFirefox\/|\bFxiOS\//, 'Firefox'],
  [/\bChrome\/|\bCriOS\/|\bChromium\//, 'Chrome'],
  // Anchored lookaheads read the header once each, whatever it holds
  [/^(?=.*\bVersion\/\d)(?=.*\bSafari\/)/, 'Safari'],
];

/** iOS and Android before the systems their user agents also name (macOS, Linux). */
const SYSTEMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\biPhone|\biPad|\biPod/, 'iOS'],
  [/\bAndroid\b/, 'Android'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bWindows\b/, 'Windows'],
  [/\bMacintosh\b|\bMac OS X\b/, 'macOS'],
  [/\bLinux\b/, 'Linux'],
];

/** User agents longer than this are not read; no real browser sends one. */
const MAX_USER_AGENT_LENGTH = 1000;

function firstMatch(table: ReadonlyArray<readonly [RegExp, string]>, userAgent: string): string | null {
  return table.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;
}

/** The browser and system names of a `User-Agent` header; anything else in it is dropped. */
export function parseUserAgent(userAgent: string | undefined): ClientSoftware {
  if (!userAgent || userAgent.length > MAX_USER_AGENT_LENGTH) return UNKNOWN_SOFTWARE;
  return { browser: firstMatch(BROWSERS, userAgent), system: firstMatch(SYSTEMS, userAgent) };
}

const storage = new AsyncLocalStorage<ClientSoftware>();

/** Runs `task` (a request, from the middleware) so that everything it awaits knows its browser and system. */
export function runWithClientSoftware<T>(software: ClientSoftware, task: () => T): T {
  return storage.run(software, task);
}

/** The browser and system of the request in progress; unknown outside one. */
export function currentClientSoftware(): ClientSoftware {
  return storage.getStore() ?? UNKNOWN_SOFTWARE;
}
