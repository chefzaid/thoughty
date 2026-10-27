import { requestJson, type AuthFetchFunction } from './base';
import type { components } from '../../generated/openapi';
import type { OptInEmailService } from './optInEmailService';

export type OnThisDayEmailSettings = components['schemas']['OnThisDayEmailSettingsDto'];
export type OnThisDayEmailChanges = components['schemas']['UpdateOnThisDayEmailDto'];

/** The writer's "On this day" email setting. Errors are translation keys, or the API's coded reason. */
export const createOnThisDayEmailService = (authFetch: AuthFetchFunction): OptInEmailService => ({
  get() {
    return requestJson(authFetch('/api/on-this-day-email'), 'onThisDayEmailLoadFailed');
  },

  save(changes) {
    return requestJson(
      authFetch('/api/on-this-day-email', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) }),
      'onThisDayEmailSaveFailed',
    );
  },
});

export type OnThisDayEmailService = ReturnType<typeof createOnThisDayEmailService>;
