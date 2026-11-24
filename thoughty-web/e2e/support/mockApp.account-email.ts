import { fulfillApiError, fulfillJson, type RouteContext } from "./mockApp.route-utils";

/** The token of the link the mock "emails" to an address given in place of a placeholder. */
export const MOCK_ADD_EMAIL_TOKEN = "add-email-token";

/** An address no mail reaches (`isPlaceholderEmail` in the API): on the reserved `.invalid` domain. */
function undeliverable(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@").pop() ?? "";
  return domain === "invalid" || domain.endsWith(".invalid");
}

/**
 * An account without an email address (`emailMissing`, a placeholder standing in): the address it gives
 * waits for its link, which sets it; the other verification routes answer as for any account.
 */
export async function handleAccountEmailRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  const { user } = state;

  if (pathname === "/api/auth/add-email") {
    const { email = "" } = request.postDataJSON() as { email?: string };
    if (!user.emailMissing) {
      await fulfillApiError(route, 409, "AUTH_EMAIL_ALREADY_SET", "This account already has an email address.");
    } else if (undeliverable(email)) {
      await fulfillApiError(route, 400, "AUTH_EMAIL_UNDELIVERABLE", "No email can reach this address.");
    } else {
      user.pendingEmail = email.trim().toLowerCase();
      state.verificationResendCount += 1;
      const { isNewUser: _isNewUser, ...me } = user;
      await fulfillJson(route, { ...me, createdAt: "2026-01-01T00:00:00.000Z" });
    }
    return true;
  }

  if (pathname === "/api/auth/resend-verification-email" && user.emailMissing && !user.pendingEmail) {
    await fulfillApiError(route, 400, "AUTH_EMAIL_MISSING", "Add an email address to your account first.");
    return true;
  }

  if (pathname === "/api/auth/verify-email" && user.pendingEmail) {
    const { token } = request.postDataJSON() as { token?: string };
    if (token !== MOCK_ADD_EMAIL_TOKEN) return false;
    user.email = user.pendingEmail;
    user.emailMissing = false;
    user.emailVerified = true;
    delete user.pendingEmail;
    await fulfillJson(route, { success: true, message: "Email verified successfully" });
    return true;
  }

  return false;
}
