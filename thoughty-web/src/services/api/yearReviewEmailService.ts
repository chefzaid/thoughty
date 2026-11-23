import { requestJson, type AuthFetchFunction } from './base';
import type { OptInEmailService } from './optInEmailService';

/** The writer's year in review email setting. Errors are translation keys, or the API's coded reason. */
export const createYearReviewEmailService = (authFetch: AuthFetchFunction): OptInEmailService => ({
  get() {
    return requestJson(authFetch('/api/year-review-email'), 'yearReviewEmailLoadFailed');
  },

  save(changes) {
    return requestJson(
      authFetch('/api/year-review-email', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) }),
      'yearReviewEmailSaveFailed',
    );
  },
});
