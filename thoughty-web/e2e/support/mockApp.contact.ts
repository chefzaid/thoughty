import type { components } from "../../src/generated/openapi";
import { fulfillApiError, fulfillJson, type RouteContext } from "./mockApp.route-utils";

type ContactMessage = components["schemas"]["ContactMessageDto"];
type ContactFailure = "CONTACT_NOT_CONFIGURED" | "CONTACT_NOT_SENT" | "RATE_LIMITED";

const FAILURES: Record<ContactFailure, { status: number; message: string }> = {
  CONTACT_NOT_CONFIGURED: { status: 503, message: "Messages cannot be sent from the Contact page on this server" },
  CONTACT_NOT_SENT: { status: 502, message: "The message could not be sent. Try again later" },
  RATE_LIMITED: { status: 429, message: "Too many requests" },
};

export interface MockContactOptions {
  /** How `POST /api/contact` refuses every message; it sends them by default. */
  failWith?: ContactFailure;
}

/** The Contact page messages the mock "emailed" to the inbox. */
export interface MockContactState {
  failWith: ContactFailure | null;
  sent: ContactMessage[];
}

export function createMockContactState(options: MockContactOptions = {}): MockContactState {
  return { failWith: options.failWith ?? null, sent: [] };
}

/** `POST /api/contact`, which the API answers once its mail server has the message. */
export async function handleContactRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (pathname !== "/api/contact" || request.method() !== "POST") return false;

  const { failWith } = state.contact;
  if (failWith) {
    const { status, message } = FAILURES[failWith];
    await fulfillApiError(route, status, failWith, message);
    return true;
  }
  const payload = request.postDataJSON() as ContactMessage;
  if (payload.website?.trim()) {
    await fulfillApiError(route, 400, "CONTACT_INVALID_REQUEST", "This message could not be accepted");
    return true;
  }
  state.contact.sent.push(payload);
  await fulfillJson(route, { success: true }, { status: 202 });
  return true;
}
