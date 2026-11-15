import type { MockAppState } from "./mockApp.shared";
import { fulfillApiError, fulfillJson, type RouteContext } from "./mockApp.route-utils";

/** The token of the link the mock "emails" on every forgot-password request. */
export const MOCK_RESET_TOKEN = "reset-token";

/** The API's password rule (`@StrongPassword()`), for every password a writer chooses. */
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

/** Answers as the API does when a chosen password breaks its rule; `true` when it did. */
export async function refuseWeakPassword(route: RouteContext["route"], password: string | undefined): Promise<boolean> {
  if (STRONG_PASSWORD.test(password ?? "")) return false;
  await fulfillApiError(route, 400, "AUTH_WEAK_PASSWORD", "Password must be at least 8 characters");
  return true;
}

/** Password reset state for the mock API, as `forgot-password`, `reset-password` and sign-in see it. */
export interface MockPasswordResetState {
  /** The addresses a link was asked for, in order. */
  forgotEmails: string[];
  lastResetPayload: { token?: string; newPassword?: string } | null;
  /** Whether the latest link already set a password. */
  linkUsed: boolean;
  /** The password set from a link; once set, signing in with another one is refused. */
  newPassword: string | null;
  /** The latest change of password from the profile. */
  lastChangePayload: { currentPassword?: string; newPassword?: string } | null;
}

const resetStates = new WeakMap<MockAppState, MockPasswordResetState>();

export function passwordResetState(state: MockAppState): MockPasswordResetState {
  let reset = resetStates.get(state);
  if (!reset) {
    reset = { forgotEmails: [], lastResetPayload: null, linkUsed: false, newPassword: null, lastChangePayload: null };
    resetStates.set(state, reset);
  }
  return reset;
}

/** Forgot, reset and change password, and a sign-in that checks the password a reset set. */
export async function handlePasswordResetRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  const reset = passwordResetState(state);

  if (pathname === "/api/auth/forgot-password") {
    const { email } = request.postDataJSON() as { email: string };
    reset.forgotEmails.push(email);
    reset.linkUsed = false;
    await fulfillJson(route, { success: true, message: "If an account exists with this email, a reset link will be sent." });
    return true;
  }

  if (pathname === "/api/auth/reset-password") {
    const payload = request.postDataJSON() as NonNullable<MockPasswordResetState["lastResetPayload"]>;
    reset.lastResetPayload = payload;
    if (payload.token !== MOCK_RESET_TOKEN || reset.linkUsed) {
      await fulfillApiError(route, 400, "AUTH_INVALID_RESET_TOKEN", "Invalid or expired reset token");
      return true;
    }
    if (await refuseWeakPassword(route, payload.newPassword)) return true;
    reset.linkUsed = true;
    reset.newPassword = payload.newPassword ?? null;
    // Every session of the account is revoked
    state.authenticated = false;
    await fulfillJson(route, { success: true, message: "Password reset successfully" });
    return true;
  }

  if (pathname === "/api/auth/change-password") {
    const payload = request.postDataJSON() as NonNullable<MockPasswordResetState["lastChangePayload"]>;
    reset.lastChangePayload = payload;
    if (await refuseWeakPassword(route, payload.newPassword)) return true;
    await fulfillJson(route, { success: true, message: "Password changed successfully" });
    return true;
  }

  if (pathname === "/api/auth/login" && reset.newPassword !== null) {
    const { password } = request.postDataJSON() as { password?: string };
    if (password !== reset.newPassword) {
      await fulfillApiError(route, 401, "AUTH_INVALID_CREDENTIALS", "Invalid credentials");
      return true;
    }
  }

  return false;
}
