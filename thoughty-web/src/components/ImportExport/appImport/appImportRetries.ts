import type { ImportResult } from '../../../services/api/appImportService';

const NETWORK_RETRY_DELAYS = [2, 5, 15];
const MAX_RATE_LIMIT_WAITS = 30;
const DEFAULT_RATE_LIMIT_WAIT = 60;

export class AppImportError extends Error {}

function wait(seconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = globalThis.setTimeout(resolve, seconds * 1000);
    signal.addEventListener('abort', () => {
      globalThis.clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

/** Retries network and server errors a few times, and waits out rate limits. */
export async function withRetries<T>(
  call: () => Promise<ImportResult<T>>,
  signal: AbortSignal,
  onWait: (seconds: number) => void,
): Promise<ImportResult<T>> {
  let networkRetries = 0;
  let rateLimitWaits = 0;
  for (;;) {
    const result = await call();
    if (result.ok || signal.aborted) {
      return result;
    }
    if (result.status === 429 && rateLimitWaits < MAX_RATE_LIMIT_WAITS) {
      rateLimitWaits++;
      const seconds = Math.min(result.retryAfterSeconds ?? DEFAULT_RATE_LIMIT_WAIT, 900);
      onWait(seconds);
      await wait(seconds, signal);
    } else if ((result.status === 0 || result.status >= 500) && networkRetries < NETWORK_RETRY_DELAYS.length) {
      await wait(NETWORK_RETRY_DELAYS[networkRetries++]!, signal);
    } else {
      return result;
    }
    if (signal.aborted) {
      return result;
    }
  }
}

