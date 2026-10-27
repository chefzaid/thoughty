import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import type { AuthFetchFunction, OptInEmailChanges, OptInEmailService, OptInEmailSettings, ServiceResult } from '../../services/api';

/** One opt-in email's setting, and saving it; a save puts the saved setting in the cache. */
export function useOptInEmail(
  queryKey: readonly string[],
  createService: (authFetch: AuthFetchFunction) => OptInEmailService,
  loadFailedKey: string,
) {
  const service = useAuthenticatedService(createService);
  const queryClient = useQueryClient();
  const setting = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await service.get();
      if (!result.data) {
        throw new Error(result.error ?? loadFailedKey);
      }
      return result.data;
    },
  });

  const save = useCallback(async (changes: OptInEmailChanges): Promise<ServiceResult<OptInEmailSettings>> => {
    const result = await service.save(changes);
    if (result.data) {
      queryClient.setQueryData(queryKey, result.data);
    }
    return result;
  }, [queryClient, queryKey, service]);

  return { setting, save };
}
