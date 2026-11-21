import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type PersonalAccessToken = components['schemas']['PersonalAccessTokenDto'];
export type CreatedPersonalAccessToken = components['schemas']['CreatedPersonalAccessTokenResponseDto'];
export type PersonalAccessTokenList = components['schemas']['PersonalAccessTokenListResponseDto'];
export type PersonalAccessTokenDraft = components['schemas']['CreatePersonalAccessTokenDto'];
export type AccessTokenScope = PersonalAccessToken['scopes'][number];

/** The scopes a token can hold, in the order the form lists them. */
export const ACCESS_TOKEN_SCOPES: readonly AccessTokenScope[] = ['entries:write', 'entries:read'];
/** The lifetimes the form offers, in days; null for a token that never expires. */
export const ACCESS_TOKEN_LIFETIMES: readonly (PersonalAccessTokenDraft['expiresInDays'])[] = [30, 90, 365, null];

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** The writer's personal access tokens for the public API. Errors are translation keys, or the API's coded reason. */
export const createAccessTokensService = (authFetch: AuthFetchFunction) => ({
  list(): Promise<ServiceResult<PersonalAccessTokenList>> {
    return requestJson(authFetch('/api/access-tokens'), 'accessTokensLoadFailed');
  },

  create(draft: PersonalAccessTokenDraft): Promise<ServiceResult<CreatedPersonalAccessToken>> {
    return requestJson(
      authFetch('/api/access-tokens', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(draft) }),
      'accessTokenCreateFailed',
    );
  },

  revoke(id: number): Promise<ServiceResult<components['schemas']['SuccessResponseDto']>> {
    return requestJson(authFetch(`/api/access-tokens/${id}`, { method: 'DELETE' }), 'accessTokenRevokeFailed');
  },
});
