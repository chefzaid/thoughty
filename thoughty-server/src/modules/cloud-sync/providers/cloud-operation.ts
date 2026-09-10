import { AsyncLocalStorage } from 'node:async_hooks';

interface CloudOperation {
  signal: AbortSignal;
  verifyOwnership: () => Promise<void>;
}
const operations = new AsyncLocalStorage<CloudOperation>();

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
  if (!operation) return globalThis.fetch(input, init);
  await verifyCloudOwnership();
  const signal = AbortSignal.any([operation.signal, AbortSignal.timeout(60_000), ...(init?.signal ? [init.signal] : [])]);
  return globalThis.fetch(input, { ...init, signal });
}
