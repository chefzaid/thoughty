const KEYCLOAK_SSO_ATTEMPT_KEY = 'thoughty.keycloak-sso-attempt';
const KEYCLOAK_SSO_START_URL = 'https://keycloak.swirlit.dev/oauth2/start';

export function hasPendingKeycloakSsoAttempt(): boolean {
  return sessionStorage.getItem(KEYCLOAK_SSO_ATTEMPT_KEY) === 'pending';
}

export function clearKeycloakSsoAttempt(): void {
  sessionStorage.removeItem(KEYCLOAK_SSO_ATTEMPT_KEY);
}

export function startKeycloakSso(returnUrl = window.location.href): void {
  sessionStorage.setItem(KEYCLOAK_SSO_ATTEMPT_KEY, 'pending');
  const loginUrl = `${KEYCLOAK_SSO_START_URL}?rd=${encodeURIComponent(returnUrl)}`;
  window.location.assign(loginUrl);
}
