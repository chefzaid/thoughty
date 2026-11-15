import type { MockAppState } from "./mockApp.shared";
import { fulfillApiError, fulfillJson, type RouteContext } from "./mockApp.route-utils";

/** The token of the link the mock "emails" on every verify-first sign-up. */
export const MOCK_SIGN_UP_TOKEN = "sign-up-token";

interface SignUpPayload {
  email?: string;
  password?: string;
  username?: string;
}

export interface MockSignUpOptions {
  /** Sign in at once (a server without email, outside production) instead of emailing a link. */
  instant?: boolean;
  /** Usernames other writers have, which the link's account cannot take. */
  takenUsernames?: string[];
}

/** Sign-up state for the mock API, as `POST /api/auth/register` and its emailed link see it. */
export interface MockSignUpState {
  instant: boolean;
  takenUsernames: string[];
  lastRegisterPayload: SignUpPayload | null;
  registerCount: number;
  lastCompletePayload: { token?: string; password?: string; username?: string } | null;
  /** Whether the link already created its account. */
  linkUsed: boolean;
}

export function createMockSignUpState(options: MockSignUpOptions = {}): MockSignUpState {
  return {
    instant: options.instant ?? false,
    takenUsernames: [...(options.takenUsernames ?? [])],
    lastRegisterPayload: null,
    registerCount: 0,
    lastCompletePayload: null,
    linkUsed: false,
  };
}

function signIn(state: MockAppState, email: string, username: string, emailVerified: boolean) {
  state.authenticated = true;
  state.user = { id: 1, username, email, authProvider: "local", emailVerified, twoFactorEnabled: false, isNewUser: true };
}

/** Registration, verify-first by default, and the link that creates the account. */
export async function handleSignUpRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  const signUp = state.signUp;

  if (pathname === "/api/auth/register") {
    const payload = request.postDataJSON() as SignUpPayload;
    signUp.lastRegisterPayload = payload;
    signUp.registerCount += 1;
    if (signUp.instant) {
      signIn(state, payload.email || "new@example.com", payload.username || "NewUser", false);
      await fulfillJson(route, { accessToken: "test-access-token", user: state.user }, { status: 201 });
      return true;
    }
    signUp.linkUsed = false;
    await fulfillJson(
      route,
      { verificationRequired: true, message: "Check your email to finish creating your account." },
      { status: 202 },
    );
    return true;
  }

  if (pathname === "/api/auth/register/complete") {
    const payload = request.postDataJSON() as NonNullable<MockSignUpState["lastCompletePayload"]>;
    signUp.lastCompletePayload = payload;
    const registered = signUp.lastRegisterPayload;
    if (payload.token !== MOCK_SIGN_UP_TOKEN || !registered || signUp.linkUsed) {
      await fulfillApiError(route, 400, "AUTH_INVALID_SIGN_UP_TOKEN", "Invalid, expired, or already used sign-up link");
      return true;
    }
    if (payload.password !== registered.password) {
      await fulfillApiError(route, 401, "AUTH_INVALID_PASSWORD", "Invalid password");
      return true;
    }
    const username = payload.username ?? registered.username ?? "new";
    if (signUp.takenUsernames.includes(username)) {
      await fulfillApiError(route, 409, "AUTH_USERNAME_TAKEN", "Username already taken");
      return true;
    }
    signUp.linkUsed = true;
    signIn(state, registered.email || "new@example.com", username, true);
    await fulfillJson(route, { accessToken: "test-access-token", user: state.user }, { status: 201 });
    return true;
  }

  return false;
}
