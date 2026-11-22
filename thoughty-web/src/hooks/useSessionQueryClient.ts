import { useEffect, useRef, useState } from 'react';
import { QueryClient } from '@tanstack/react-query';

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

/**
 * One query cache per session: when `sessionKey` moves on (a session ended), the app reads from a new,
 * empty cache in that same render, and the old one has its requests cancelled and everything in it
 * dropped. A request or callback that outlived the session can only write into the old cache, which
 * nothing reads any more. A session that was `offline` (opened without reaching the API) reads
 * everything again once it is back, since what it asked for meanwhile could not be answered.
 */
export function useSessionQueryClient(sessionKey: number, offline = false): QueryClient {
  const [scope, setScope] = useState(() => ({ sessionKey, client: createAppQueryClient() }));
  let current = scope;
  if (scope.sessionKey !== sessionKey) {
    current = { sessionKey, client: createAppQueryClient() };
    setScope(current);
  }

  const shownRef = useRef(current.client);
  useEffect(() => {
    const previous = shownRef.current;
    if (previous === current.client) return;
    shownRef.current = current.client;
    void previous.cancelQueries();
    previous.clear();
  }, [current.client]);

  const wasOffline = useRef(offline);
  useEffect(() => {
    if (wasOffline.current && !offline) void current.client.invalidateQueries();
    wasOffline.current = offline;
  }, [current.client, offline]);

  return current.client;
}
