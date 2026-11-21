import {
  currentClientSoftware,
  parseUserAgent,
  runWithClientSoftware,
  UNKNOWN_SOFTWARE,
} from './client-software';
import { ClientSoftwareMiddleware } from './client-software.middleware';

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

describe('parseUserAgent', () => {
  it.each([
    [CHROME_WINDOWS, 'Chrome', 'Windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:132.0) Gecko/20100101 Firefox/132.0', 'Firefox', 'macOS'],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
      'Safari',
      'iOS',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
      'Chrome',
      'iOS',
    ],
    [`${CHROME_WINDOWS} Edg/130.0.2849.68`, 'Edge', 'Windows'],
    [
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0',
      'Opera',
      'Linux',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
      'Samsung Internet',
      'Android',
    ],
    [
      'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Chrome',
      'ChromeOS',
    ],
  ])('names the browser and system of %s, without versions', (userAgent, browser, system) => {
    expect(parseUserAgent(userAgent)).toEqual({ browser, system });
  });

  it('knows nothing of a missing, unknown or oversized user agent', () => {
    expect(parseUserAgent(undefined)).toBe(UNKNOWN_SOFTWARE);
    expect(parseUserAgent('')).toBe(UNKNOWN_SOFTWARE);
    expect(parseUserAgent('curl/8.5.0')).toEqual({ browser: null, system: null });
    // Safari's token alone, without its Version, is any WebKit browser
    expect(parseUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/130.0.0.0 Safari/537.36')).toEqual({
      browser: null,
      system: 'Linux',
    });
    expect(parseUserAgent(`${CHROME_WINDOWS} ${'x'.repeat(1000)}`)).toBe(UNKNOWN_SOFTWARE);
  });
});

describe('client software of the request', () => {
  it('is what the middleware read, for everything the request awaits, and unknown outside one', async () => {
    expect(currentClientSoftware()).toBe(UNKNOWN_SOFTWARE);
    const seen = await new Promise((resolve) => {
      new ClientSoftwareMiddleware().use(
        { headers: { 'user-agent': CHROME_WINDOWS } } as never,
        {} as never,
        () => {
          void Promise.resolve().then(() => resolve(currentClientSoftware()));
        },
      );
    });
    expect(seen).toEqual({ browser: 'Chrome', system: 'Windows' });
    expect(currentClientSoftware()).toBe(UNKNOWN_SOFTWARE);
  });

  it('runs a task with the given software', () => {
    const software = { browser: 'Firefox', system: 'Linux' };
    expect(runWithClientSoftware(software, () => currentClientSoftware())).toBe(software);
  });
});
