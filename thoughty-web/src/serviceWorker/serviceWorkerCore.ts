/**
 * The service worker's logic, kept apart from its entry (`sw.ts`) so it can be tested. It keeps the app
 * shell for offline use, and nothing else:
 * - one cache per build (`thoughty-shell-<version>`), filled when the worker installs, with `index.html`
 *   and the build's scripts, styles, fonts and icons (`precache`); older builds' caches go when it activates;
 * - a page load always asks the network first, so an online visit always gets the current app; only when
 *   the network fails does it get the cached `index.html`, stored under that one key, so no address (and no
 *   token or shared text in one) ever becomes a cache key;
 * - the build's files come from the cache, since their names change with their content (a query string
 *   on one changes nothing on the static server, so it is ignored);
 * - nothing under `/api/`, no other method than GET, and no other origin is ever answered or stored: the
 *   writer's data stays between the page and the API.
 */
export const CACHE_PREFIX = 'thoughty-shell-';
export const SHELL_URL = '/index.html';

export interface ExtendableEventLike extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

export interface FetchEventLike extends ExtendableEventLike {
  readonly request: Request;
  respondWith(response: Promise<Response>): void;
}

/** What the worker needs of its global scope. */
export interface ServiceWorkerScopeLike {
  readonly location: { readonly origin: string };
  readonly caches: CacheStorage;
  fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
  skipWaiting(): Promise<void>;
  readonly clients: { claim(): Promise<void> };
  addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEventLike) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEventLike) => void): void;
}

export interface ShellBuild {
  /** Changes with every build whose shell differs. */
  readonly version: string;
  /** Same-origin paths of the build's files to keep, `index.html` aside. */
  readonly precache: readonly string[];
}

export const cacheNameFor = (version: string): string => `${CACHE_PREFIX}${version}`;

const isApiPath = (pathname: string): boolean => pathname === '/api' || pathname.startsWith('/api/');

/** The build files `index.html` loads (its scripts, styles and preloads). */
export function shellReferences(html: string): string[] {
  return Array.from(html.matchAll(/\b(?:src|href)="(\/assets\/[^"?#]+)[^"]*"/g), (match) => match[1] as string);
}

/**
 * Fills this build's cache. The `index.html` fetched must be this build's (every file it loads is in the
 * precache list): during a rollout it could come from a server still on the previous build, and a shell
 * whose files are missing would not open offline. The install then fails and is tried again later.
 */
export async function installShell(scope: Pick<ServiceWorkerScopeLike, 'caches' | 'fetch' | 'location'>, build: ShellBuild): Promise<void> {
  const response = await scope.fetch(SHELL_URL, { cache: 'reload', credentials: 'same-origin' });
  if (!response.ok) throw new Error(`The app shell answered ${response.status}`);
  const html = await response.clone().text();
  const known = new Set(build.precache);
  const missing = shellReferences(html).filter((path) => !known.has(path));
  if (missing.length > 0) throw new Error(`The app shell is from another build (${missing.join(', ')})`);

  const cache = await scope.caches.open(cacheNameFor(build.version));
  await cache.addAll(build.precache.map((path) => new Request(new URL(path, scope.location.origin), { cache: 'reload', credentials: 'same-origin' })));
  await cache.put(SHELL_URL, response);
}

/** Removes the caches of older builds, and leaves any cache that is not the shell's alone. */
export async function removeOldShells(caches: CacheStorage, version: string): Promise<void> {
  const current = cacheNameFor(version);
  const names = await caches.keys();
  await Promise.all(names
    .filter((name) => name.startsWith(CACHE_PREFIX) && name !== current)
    .map((name) => caches.delete(name)));
}

/**
 * The answer to a request, or null to leave it to the browser: page loads of the app (network first, the
 * cached shell when offline) and the build's own files (cache first). Everything else is never touched.
 */
export function respondTo(request: Request, scope: Pick<ServiceWorkerScopeLike, 'caches' | 'fetch' | 'location'>, build: ShellBuild): Promise<Response> | null {
  if (request.method !== 'GET') return null;
  const url = new URL(request.url);
  if (url.origin !== scope.location.origin || isApiPath(url.pathname)) return null;
  const cacheName = cacheNameFor(build.version);

  if (request.mode === 'navigate') {
    return scope.fetch(request).catch(async (error: unknown) => {
      const shell = await scope.caches.match(SHELL_URL, { cacheName });
      if (shell) return shell;
      throw error;
    });
  }
  // A query on a build file changes nothing it is served with (the stylesheets load the icon font with one)
  if (build.precache.includes(url.pathname)) {
    return scope.caches.match(url.pathname, { cacheName }).then((cached) => cached ?? scope.fetch(request));
  }
  return null;
}

/** Wires the worker's events: install fills the cache and takes over at once, activate clears old builds. */
export function startServiceWorker(scope: ServiceWorkerScopeLike, build: ShellBuild): void {
  scope.addEventListener('install', (event) => {
    event.waitUntil(installShell(scope, build).then(() => scope.skipWaiting()));
  });
  scope.addEventListener('activate', (event) => {
    event.waitUntil(removeOldShells(scope.caches, build.version).then(() => scope.clients.claim()));
  });
  scope.addEventListener('fetch', (event) => {
    const response = respondTo(event.request, scope, build);
    if (response) event.respondWith(response);
  });
}
