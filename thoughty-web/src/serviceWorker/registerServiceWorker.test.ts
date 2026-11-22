import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from './registerServiceWorker';

function stubContainer(register: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('navigator', { ...navigator, serviceWorker: { register } });
}

describe('registerServiceWorker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('registers /sw.js for the whole app once the page has loaded, bypassing the HTTP cache', async () => {
    const register = vi.fn().mockResolvedValue({});
    stubContainer(register);

    registerServiceWorker(true);
    expect(register).not.toHaveBeenCalled();
    globalThis.dispatchEvent(new Event('load'));
    globalThis.dispatchEvent(new Event('load'));

    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/', updateViaCache: 'none' });
  });

  it('registers nothing outside a production build, or in a browser without service workers', () => {
    const register = vi.fn().mockResolvedValue({});
    stubContainer(register);
    registerServiceWorker(false);
    globalThis.dispatchEvent(new Event('load'));

    vi.stubGlobal('navigator', { ...navigator, serviceWorker: undefined });
    registerServiceWorker(true);
    globalThis.dispatchEvent(new Event('load'));

    expect(register).not.toHaveBeenCalled();
  });

  it('leaves the app working online when the registration fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubContainer(vi.fn().mockRejectedValue(new Error('blocked')));

    registerServiceWorker(true);
    globalThis.dispatchEvent(new Event('load'));

    await vi.waitFor(() => expect(error).toHaveBeenCalledWith('Service worker registration failed:', expect.any(Error)));
  });
});
