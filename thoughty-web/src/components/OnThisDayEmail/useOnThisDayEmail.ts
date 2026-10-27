import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import {
  createOnThisDayEmailService,
  type OnThisDayEmailChanges,
  type OnThisDayEmailSettings,
  type ServiceResult,
} from '../../services/api';

export const ON_THIS_DAY_EMAIL_QUERY_KEY = ['onThisDayEmail'] as const;

/** The "On this day" email setting, and saving it; a save puts the saved setting in the cache. */
export function useOnThisDayEmail() {
  const service = useAuthenticatedService(createOnThisDayEmailService);
  const queryClient = useQueryClient();
  const setting = useQuery({
    queryKey: ON_THIS_DAY_EMAIL_QUERY_KEY,
    queryFn: async () => {
      const result = await service.get();
      if (!result.data) {
        throw new Error(result.error ?? 'onThisDayEmailLoadFailed');
      }
      return result.data;
    },
  });

  const save = useCallback(async (changes: OnThisDayEmailChanges): Promise<ServiceResult<OnThisDayEmailSettings>> => {
    const result = await service.save(changes);
    if (result.data) {
      queryClient.setQueryData(ON_THIS_DAY_EMAIL_QUERY_KEY, result.data);
    }
    return result;
  }, [queryClient, service]);

  return { setting, save };
}
