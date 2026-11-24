import type { SignUpPreferences } from '../contexts/authTypes';

const KEYCLOAK_SSO_ATTEMPT_KEY = 'thoughty.keycloak-sso-attempt';
const KEYCLOAK_SSO_FAILED_KEY = 'thoughty.keycloak-sso-failed';
const KEYCLOAK_SSO_PREFERENCES_KEY = 'thoughty.keycloak-sso-preferences';
const KEYCLOAK_SSO_START_URL = 'https://keycloak.swirlit.dev/oauth2/start';

export function hasPendingKeycloakSsoAttempt(): boolean {
  return sessionStorage.getItem(KEYCLOAK_SSO_ATTEMPT_KEY) === 'pending';
}

export function clearKeycloakSsoAttempt(): void {
  sessionStorage.removeItem(KEYCLOAK_SSO_ATTEMPT_KEY);
}

/** Remembers that the way back from Keycloak did not yield a session, for the sign-in page to say so. */
export function markKeycloakSsoFailed(): void {
  sessionStorage.setItem(KEYCLOAK_SSO_FAILED_KEY, 'true');
}

export function hasKeycloakSsoFailure(): boolean {
  return sessionStorage.getItem(KEYCLOAK_SSO_FAILED_KEY) === 'true';
}

export function clearKeycloakSsoFailure(): void {
  sessionStorage.removeItem(KEYCLOAK_SSO_FAILED_KEY);
}

/**
 * Leaves for Keycloak's sign-in page. The language and theme shown to the visitor are kept for the
 * way back, as the page reloads there, so an account the exchange creates starts with them.
 */
export function startKeycloakSso(returnUrl = window.location.href, preferences: SignUpPreferences = {}): void {
  sessionStorage.setItem(KEYCLOAK_SSO_ATTEMPT_KEY, 'pending');
  sessionStorage.setItem(KEYCLOAK_SSO_PREFERENCES_KEY, JSON.stringify(preferences));
  clearKeycloakSsoFailure();
  const loginUrl = `${KEYCLOAK_SSO_START_URL}?rd=${encodeURIComponent(returnUrl)}`;
  window.location.assign(loginUrl);
}

/**
 * The query of the Keycloak exchange (`language=fr&theme=light`, or empty): the preferences kept
 * by `startKeycloakSso`, read once. Only values the app offers are sent, whatever the storage holds.
 */
export function takeKeycloakSsoPreferencesQuery(): string {
  const stored = sessionStorage.getItem(KEYCLOAK_SSO_PREFERENCES_KEY);
  sessionStorage.removeItem(KEYCLOAK_SSO_PREFERENCES_KEY);
  let preferences: Record<string, unknown> = {};
  try {
    preferences = (JSON.parse(stored ?? '{}') as Record<string, unknown> | null) ?? {};
  } catch {
    // Unreadable: the account defaults apply
  }
  const query = new URLSearchParams();
  if (preferences.language === 'en' || preferences.language === 'fr') query.set('language', preferences.language);
  if (preferences.theme === 'light' || preferences.theme === 'dark') query.set('theme', preferences.theme);
  return query.toString();
}
