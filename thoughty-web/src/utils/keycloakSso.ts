const KEYCLOAK_SSO_ATTEMPT_KEY = 'thoughty.keycloak-sso-attempt';
const KEYCLOAK_SSO_FAILED_KEY = 'thoughty.keycloak-sso-failed';
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

export function startKeycloakSso(returnUrl = window.location.href): void {
  sessionStorage.setItem(KEYCLOAK_SSO_ATTEMPT_KEY, 'pending');
  clearKeycloakSsoFailure();
  const loginUrl = `${KEYCLOAK_SSO_START_URL}?rd=${encodeURIComponent(returnUrl)}`;
  window.location.assign(loginUrl);
}
