import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  globalThis.addEventListener('online', onChange);
  globalThis.addEventListener('offline', onChange);
  return () => {
    globalThis.removeEventListener('online', onChange);
    globalThis.removeEventListener('offline', onChange);
  };
}

const isOnline = (): boolean => globalThis.navigator?.onLine !== false;

/** Whether the browser says it has a connection, following its `online` and `offline` events. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}
