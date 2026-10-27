import { requestJson, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type OptInEmailSettings = components['schemas']['OptInEmailSettingsDto'];
export type OptInEmailChanges = components['schemas']['UpdateOptInEmailDto'];
export type EmailUnsubscribeResult = components['schemas']['EmailUnsubscribeResultDto'];
/** The emails a writer can opt into, as the unsubscribe link names them. */
export type OptInEmailKind = EmailUnsubscribeResult['kind'];

/** One opt-in email's setting. Errors are translation keys, or the API's coded reason. */
export interface OptInEmailService {
  get(): Promise<ServiceResult<OptInEmailSettings>>;
  save(changes: OptInEmailChanges): Promise<ServiceResult<OptInEmailSettings>>;
}

/** Turns off the email an unsubscribe link's token names and says which one; no sign-in needed. */
export function unsubscribeEmail(token: string, fetchImpl: typeof fetch = fetch): Promise<ServiceResult<EmailUnsubscribeResult>> {
  return requestJson(
    fetchImpl(`/api/email-unsubscribe?${new URLSearchParams({ token }).toString()}`, { method: 'POST' }),
    'emailUnsubscribeFailed',
  );
}
