import { useMemo } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { createAuthFetch, type AuthFetchFunction } from '../services/api';

/** Builds an API service bound to the signed-in session; `createService` must be a stable module-level factory. */
export function useAuthenticatedService<T>(createService: (authFetch: AuthFetchFunction) => T): T {
  const { authFetch, getAccessToken } = useAuth();
  const authFetchHelper = useMemo(
    () => createAuthFetch(authFetch, getAccessToken),
    [authFetch, getAccessToken],
  );

  return useMemo(() => createService(authFetchHelper), [createService, authFetchHelper]);
}
