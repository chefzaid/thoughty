import { requestJson, type AuthFetchFunction } from './base';
import type { OptInEmailService } from './optInEmailService';

/** The writer's monthly recap email setting. Errors are translation keys, or the API's coded reason. */
export const createMonthlyRecapEmailService = (authFetch: AuthFetchFunction): OptInEmailService => ({
  get() {
    return requestJson(authFetch('/api/monthly-recap-email'), 'monthlyRecapEmailLoadFailed');
  },

  save(changes) {
    return requestJson(
      authFetch('/api/monthly-recap-email', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) }),
      'monthlyRecapEmailSaveFailed',
    );
  },
});
