import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type OnThisDayEmailSettings = components['schemas']['OnThisDayEmailSettingsDto'];
export type OnThisDayEmailChanges = components['schemas']['UpdateOnThisDayEmailDto'];
type UnsubscribeResult = components['schemas']['SuccessResponseDto'];

/** The writer's "On this day" email setting. Errors are translation keys, or the API's coded reason. */
export const createOnThisDayEmailService = (authFetch: AuthFetchFunction) => ({
  get(): Promise<ServiceResult<OnThisDayEmailSettings>> {
    return requestJson(authFetch('/api/on-this-day-email'), 'onThisDayEmailLoadFailed');
  },

  save(changes: OnThisDayEmailChanges): Promise<ServiceResult<OnThisDayEmailSettings>> {
    return requestJson(
      authFetch('/api/on-this-day-email', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) }),
      'onThisDayEmailSaveFailed',
    );
  },
});

export type OnThisDayEmailService = ReturnType<typeof createOnThisDayEmailService>;

/** Turns the email off from the token in its unsubscribe link; no sign-in needed. */
export function unsubscribeOnThisDayEmail(token: string, fetchImpl: typeof fetch = fetch): Promise<ServiceResult<UnsubscribeResult>> {
  return requestJson(
    fetchImpl(`/api/on-this-day-email/unsubscribe?${new URLSearchParams({ token }).toString()}`, { method: 'POST' }),
    'onThisDayUnsubscribeFailed',
  );
}
