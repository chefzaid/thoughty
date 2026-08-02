import { useMemo } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { createAuthFetch, createFeedService } from '../services/api';

export function useFeedService() {
  const { authFetch, getAccessToken } = useAuth();
  const authFetchHelper = useMemo(
    () => createAuthFetch(authFetch, getAccessToken),
    [authFetch, getAccessToken],
  );

  return useMemo(() => createFeedService(authFetchHelper), [authFetchHelper]);
}
