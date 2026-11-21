import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type AccountEvent = components['schemas']['AccountEventDto'];
export type AccountEventKind = AccountEvent['kind'];
export type AccountActivityPage = components['schemas']['AccountActivityResponseDto'];
export type NewBrowserEmailState = components['schemas']['NewBrowserEmailResponseDto'];

/** The account's sign-ins and security changes, and the new-browser sign-in email. Errors are translation keys. */
export const createAccountActivityService = (authFetch: AuthFetchFunction) => ({
  /** One page of the past year's events, newest first; `before` is the `nextBefore` of the page above. */
  list(before?: number): Promise<ServiceResult<AccountActivityPage>> {
    const url = before ? `/api/auth/activity?${new URLSearchParams({ before: String(before) }).toString()}` : '/api/auth/activity';
    return requestJson(authFetch(url), 'accountActivityLoadError');
  },

  setNewBrowserEmail(enabled: boolean): Promise<ServiceResult<NewBrowserEmailState>> {
    return requestJson(
      authFetch('/api/auth/activity/new-browser-email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      }),
      'newBrowserEmailSaveError',
    );
  },
});
