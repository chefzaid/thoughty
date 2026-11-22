import { describe, expect, it, vi } from 'vitest';
import {
  cacheNameFor,
  installShell,
  removeOldShells,
  respondTo,
  shellReferences,
  startServiceWorker,
  type ExtendableEventLike,
  type FetchEventLike,
  type ServiceWorkerScopeLike,
  type ShellBuild,
} from './serviceWorkerCore';

const ORIGIN = 'https://thoughty.example';
const SHELL_HTML = '<script type="module" crossorigin src="/assets/index-A1.js"></script><link rel="stylesheet" href="/assets/index-B2.css">';
const BUILD: ShellBuild = { version: 'v2', precache: ['/assets/index-A1.js', '/assets/index-B2.css', '/favicon.svg'] };

/** Caches in memory, keyed by path, as `CacheStorage` keeps them. */
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const pathOf = (input: RequestInfo | URL) => new URL(input instanceof Request ? input.url : String(input), ORIGIN).pathname;
  const openStore = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name) as Map<string, Response>;
  };
  const storage = {
    open: vi.fn(async (name: string) => {
      const store = openStore(name);
      return {
        addAll: async (requests: Request[]) => {
          for (const request of requests) store.set(pathOf(request), new Response(`file ${pathOf(request)}`));
        },
        put: async (input: RequestInfo, response: Response) => {
          store.set(pathOf(input), response);
        },
      };
    }),
    keys: async () => [...stores.keys()],
    delete: vi.fn(async (name: string) => stores.delete(name)),
    match: async (input: RequestInfo, options?: { cacheName?: string }) => stores.get(options?.cacheName ?? '')?.get(pathOf(input)),
  };
  return { storage: storage as unknown as CacheStorage & typeof storage, stores };
}

function fakeScope(fetchImpl: (input: RequestInfo, init?: RequestInit) => Promise<Response>) {
  const { storage, stores } = fakeCaches();
  const listeners: Record<string, (event: never) => void> = {};
  const scope = {
    location: { origin: ORIGIN },
    caches: storage,
    fetch: vi.fn(fetchImpl),
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
    addEventListener: (type: string, listener: (event: never) => void) => {
      listeners[type] = listener;
    },
  };
  return { scope: scope as unknown as ServiceWorkerScopeLike & typeof scope, stores, listeners };
}

const offline = () => Promise.reject(new TypeError('Failed to fetch'));
/** A request from the app; `navigate` (a page load), which no page can build, is set on it afterwards. */
const page = (path: string, { mode, ...init }: RequestInit = {}) => {
  const request = new Request(`${ORIGIN}${path}`, init);
  Object.defineProperty(request, 'mode', { value: mode ?? 'cors' });
  return request;
};

describe('serviceWorkerCore', () => {
  it('reads the build files index.html loads', () => {
    expect(shellReferences(`${SHELL_HTML}<link rel="icon" href="/favicon.svg"><link rel="modulepreload" href="/assets/c-C3.js?v=1">`))
      .toEqual(['/assets/index-A1.js', '/assets/index-B2.css', '/assets/c-C3.js']);
  });

  it('fills this build’s cache with the shell and its files, fetched past the HTTP cache', async () => {
    const { scope, stores } = fakeScope(async () => new Response(SHELL_HTML));

    await installShell(scope, BUILD);

    expect(scope.fetch).toHaveBeenCalledWith('/index.html', { cache: 'reload', credentials: 'same-origin' });
    const store = stores.get(cacheNameFor('v2'));
    expect([...(store?.keys() ?? [])].sort()).toEqual(['/assets/index-A1.js', '/assets/index-B2.css', '/favicon.svg', '/index.html']);
    expect(await store?.get('/index.html')?.text()).toBe(SHELL_HTML);
  });

  it('refuses a shell from another build, or one the server would not send', async () => {
    const other = fakeScope(async () => new Response('<script src="/assets/index-OLD.js"></script>'));
    await expect(installShell(other.scope, BUILD)).rejects.toThrow('another build (/assets/index-OLD.js)');
    expect(other.stores.size).toBe(0);

    const failing = fakeScope(async () => new Response('', { status: 503 }));
    await expect(installShell(failing.scope, BUILD)).rejects.toThrow('answered 503');
  });

  it('removes older builds’ caches and leaves other caches alone', async () => {
    const { storage, stores } = fakeCaches();
    for (const name of ['thoughty-shell-v1', 'thoughty-shell-v2', 'something-else']) await storage.open(name);

    await removeOldShells(storage, 'v2');

    expect([...stores.keys()]).toEqual(['thoughty-shell-v2', 'something-else']);
  });

  it('loads pages from the network first, and from the cached shell only when it fails', async () => {
    const { scope } = fakeScope(async () => new Response(SHELL_HTML));
    await installShell(scope, BUILD);

    scope.fetch.mockResolvedValueOnce(new Response('fresh page'));
    expect(await (await respondTo(page('/journal', { mode: 'navigate' }), scope, BUILD))?.text()).toBe('fresh page');

    scope.fetch.mockImplementation(offline);
    // Shared text in the address never becomes a cache key: every page gets the one shell
    expect(await (await respondTo(page('/share-target?text=private', { mode: 'navigate' }), scope, BUILD))?.text()).toBe(SHELL_HTML);
  });

  it('lets a page load fail as the network did when no shell is kept yet', async () => {
    const { scope } = fakeScope(offline);

    await expect(respondTo(page('/journal', { mode: 'navigate' }), scope, BUILD)).rejects.toThrow('Failed to fetch');
  });

  it('serves the build’s own files from the cache, and from the network when missing', async () => {
    const { scope } = fakeScope(async () => new Response(SHELL_HTML));
    await installShell(scope, BUILD);
    scope.fetch.mockClear();

    expect(await (await respondTo(page('/assets/index-A1.js'), scope, BUILD))?.text()).toBe('file /assets/index-A1.js');
    // The stylesheets ask for the icon font with a query string
    expect(await (await respondTo(page('/favicon.svg?721d4c0a'), scope, BUILD))?.text()).toBe('file /favicon.svg');
    expect(scope.fetch).not.toHaveBeenCalled();

    const empty = fakeScope(async () => new Response('from the network'));
    expect(await (await respondTo(page('/favicon.svg'), empty.scope, BUILD))?.text()).toBe('from the network');
  });

  it('never answers the API, another method, another origin or a file outside the build', () => {
    const { scope } = fakeScope(async () => new Response(''));

    expect(respondTo(page('/api/entries'), scope, BUILD)).toBeNull();
    expect(respondTo(page('/api', { mode: 'navigate' }), scope, BUILD)).toBeNull();
    expect(respondTo(page('/api/auth/google', { mode: 'navigate' }), scope, BUILD)).toBeNull();
    expect(respondTo(page('/journal', { method: 'POST', mode: 'navigate' }), scope, BUILD)).toBeNull();
    expect(respondTo(new Request('https://lh3.googleusercontent.com/a.png'), scope, BUILD)).toBeNull();
    expect(respondTo(page('/assets/pdf-X1.js'), scope, BUILD)).toBeNull();
    expect(scope.fetch).not.toHaveBeenCalled();
  });

  it('installs, takes over at once once filled, and answers only what it keeps', async () => {
    const { scope, listeners } = fakeScope(async () => new Response(SHELL_HTML));
    startServiceWorker(scope, BUILD);
    const waited: Promise<unknown>[] = [];
    const lifecycle = (): ExtendableEventLike => ({ waitUntil: (promise: Promise<unknown>) => waited.push(promise) }) as unknown as ExtendableEventLike;

    listeners.install?.(lifecycle() as never);
    await Promise.all(waited);
    expect(scope.skipWaiting).toHaveBeenCalled();

    listeners.activate?.(lifecycle() as never);
    await Promise.all(waited);
    expect(scope.clients.claim).toHaveBeenCalled();

    const respondWith = vi.fn();
    const fetchEvent = (request: Request) => ({ request, respondWith }) as unknown as FetchEventLike;
    listeners.fetch?.(fetchEvent(page('/api/entries')) as never);
    expect(respondWith).not.toHaveBeenCalled();
    listeners.fetch?.(fetchEvent(page('/assets/index-B2.css')) as never);
    expect(respondWith).toHaveBeenCalledTimes(1);
    expect(await (await respondWith.mock.calls[0]?.[0])?.text()).toBe('file /assets/index-B2.css');
  });
});
