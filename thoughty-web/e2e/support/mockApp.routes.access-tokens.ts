import { randomBytes } from "node:crypto";
import type { components } from "../../src/generated/openapi";
import type { MockAppState } from "./mockApp.shared";
import { recordMockAccountEvent } from "./mockApp.account-activity";
import { fulfillApiError, fulfillJson, isTimeZone, type RouteContext } from "./mockApp.route-utils";

type AccessToken = components["schemas"]["PersonalAccessTokenDto"];
type AccessTokenDraft = components["schemas"]["CreatePersonalAccessTokenDto"];

export const MOCK_ACCESS_TOKEN_LIMIT = 10;
const SCOPES = ["entries:read", "entries:write"] as const;
const LIFETIMES = [30, 90, 365, null];
const DAY_MS = 24 * 60 * 60 * 1000;

/** A token as the mock keeps it: the API's fields and the secret it would only keep the hash of. */
export interface MockAccessToken extends AccessToken {
  token: string;
  timeZone: string;
}

const tokensByState = new WeakMap<MockAppState, MockAccessToken[]>();

/** The personal access tokens of a mock app, kept beside its state, newest first. */
export function mockAccessTokens(state: MockAppState): MockAccessToken[] {
  let tokens = tokensByState.get(state);
  if (!tokens) {
    tokens = [];
    tokensByState.set(state, tokens);
  }
  return tokens;
}

const toResponse = ({ token: _token, timeZone: _timeZone, ...listed }: MockAccessToken): AccessToken => listed;

/** Whether the draft is one the API's validation takes. */
function isValidDraft(draft: Partial<AccessTokenDraft>): draft is AccessTokenDraft {
  const name = typeof draft.name === "string" ? draft.name.trim() : "";
  return name.length > 0 && name.length <= 60
    && Array.isArray(draft.scopes) && draft.scopes.length > 0
    && new Set(draft.scopes).size === draft.scopes.length
    && draft.scopes.every((scope) => (SCOPES as readonly string[]).includes(scope))
    && LIFETIMES.includes(draft.expiresInDays ?? -1)
    && isTimeZone(draft.timeZone);
}

/** `/api/access-tokens`: the writer's tokens, made (shown once), listed and revoked as the API does. */
export async function handleAccessTokenRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  const tokens = mockAccessTokens(state);
  if (pathname === "/api/access-tokens" && request.method() === "GET") {
    await fulfillJson(route, { tokens: tokens.map(toResponse), limit: MOCK_ACCESS_TOKEN_LIMIT });
    return true;
  }

  if (pathname === "/api/access-tokens" && request.method() === "POST") {
    const draft = request.postDataJSON() as Partial<AccessTokenDraft>;
    if (!isValidDraft(draft)) {
      await fulfillApiError(route, 400, "VALIDATION_FAILED", "The request is invalid");
      return true;
    }
    if (tokens.length >= MOCK_ACCESS_TOKEN_LIMIT) {
      await fulfillApiError(route, 400, "ACCESS_TOKEN_LIMIT_REACHED", `Access token limit reached (${MOCK_ACCESS_TOKEN_LIMIT})`);
      return true;
    }
    const secret = `thy_${randomBytes(32).toString("base64url")}`;
    const now = Date.now();
    const created: MockAccessToken = {
      id: Math.max(0, ...tokens.map((token) => token.id)) + 1,
      name: draft.name.trim(),
      hint: secret.slice(0, 8),
      scopes: SCOPES.filter((scope) => draft.scopes.includes(scope)),
      expiresAt: draft.expiresInDays === null ? null : new Date(now + draft.expiresInDays * DAY_MS).toISOString(),
      lastUsedAt: null,
      createdAt: new Date(now).toISOString(),
      token: secret,
      timeZone: draft.timeZone,
    };
    tokens.unshift(created);
    recordMockAccountEvent(state.accountActivity, "access_token_created");
    await fulfillJson(route, { ...toResponse(created), token: secret }, { status: 201 });
    return true;
  }

  const revoke = /^\/api\/access-tokens\/(\d+)$/.exec(pathname);
  if (revoke && request.method() === "DELETE") {
    const index = tokens.findIndex((token) => token.id === Number(revoke[1]));
    if (index < 0) {
      await fulfillApiError(route, 404, "ACCESS_TOKEN_NOT_FOUND", "Access token not found");
      return true;
    }
    tokens.splice(index, 1);
    recordMockAccountEvent(state.accountActivity, "access_token_revoked");
    await fulfillJson(route, { success: true });
    return true;
  }

  return false;
}
