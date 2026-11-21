import type { AccessTokenScope, PersonalAccessTokenDraft } from '../../services/api';

/** The translation key naming what each scope lets a token do. */
export const SCOPE_LABELS: Record<AccessTokenScope, string> = {
  'entries:write': 'accessTokenScopeWrite',
  'entries:read': 'accessTokenScopeRead',
};

/** The translation key of a lifetime the form offers; null for a token that never expires. */
export const lifetimeLabel = (days: PersonalAccessTokenDraft['expiresInDays']): string =>
  days === null ? 'accessTokenLifetimeNever' : `accessTokenLifetime${days}`;
