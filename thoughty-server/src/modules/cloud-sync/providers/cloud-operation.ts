import { AsyncLocalStorage } from 'node:async_hooks';
import { BadGatewayException, Logger } from '@nestjs/common';
import { apiError } from '@/common/errors';

interface CloudOperation {
  signal: AbortSignal;
  verifyOwnership: () => Promise<void>;
}
const operations = new AsyncLocalStorage<CloudOperation>();
const logger = new Logger('CloudFetch');

export function withCloudOperation<T>(operation: CloudOperation, execute: () => Promise<T>): Promise<T> {
  return operations.run(operation, execute);
}

export function checkCloudCancellation(): void {
  operations.getStore()?.signal.throwIfAborted();
}

export async function verifyCloudOwnership(): Promise<void> {
  checkCloudCancellation();
  await operations.getStore()?.verifyOwnership();
  checkCloudCancellation();
}

// Each scheduled operation has its own cancellation context. Manual API calls
// retain their existing behavior; cancelling one worker never cancels another.
export async function cloudFetch(input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> {
  const operation = operations.getStore();
  if (!operation) return reachProvider(input, init, init?.signal ?? undefined);
  await verifyCloudOwnership();
  const signal = AbortSignal.any([operation.signal, AbortSignal.timeout(60_000), ...(init?.signal ? [init.signal] : [])]);
  return reachProvider(input, { ...init, signal }, operation.signal);
}

/**
 * Sends a provider request. A provider that cannot be reached (network failure, timeout) answers a 502
 * `CLOUD_PROVIDER_FAILED`; a cancelled operation keeps its own error so the worker sees the cancellation.
 */
async function reachProvider(input: Parameters<typeof fetch>[0], init: RequestInit | undefined, cancelSignal: AbortSignal | undefined): Promise<Response> {
  try {
    return await globalThis.fetch(input, init);
  } catch (error) {
    if (cancelSignal?.aborted) throw error;
    logger.error(`Cloud provider request to ${providerHost(input)} failed: ${error instanceof Error ? error.name : 'unknown error'}`);
    throw apiError(BadGatewayException, 'CLOUD_PROVIDER_FAILED');
  }
}

/** The host a request goes to, without its path or query (which can carry file ids). */
function providerHost(input: Parameters<typeof fetch>[0]): string {
  const url = input instanceof Request ? input.url : String(input);
  try {
    return new URL(url).host;
  } catch {
    return 'the provider';
  }
}
