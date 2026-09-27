import type { Page } from "@playwright/test";
import { unique, type MockAppState } from "./mockApp.shared";
import { fulfillJson, type RouteContext } from "./mockApp.route-utils";
import { handleCloudSyncRoutes } from "./mockApp.routes.cloud-sync";
import { handleAiCredentialRoutes } from "./mockApp.routes.ai-credentials";
import { handleEntriesRoutes } from "./mockApp.routes.entries";
import { handleBookRoutes, handleIoRoutes } from "./mockApp.routes.io";
import { handleReferenceRoutes } from "./mockApp.routes.reference";
import { handleSocialRoutes } from "./mockApp.routes.social";

async function handleAuthRoutes({
  route,
  request,
  pathname,
  state,
}: RouteContext): Promise<boolean> {
  if (pathname === "/api/auth/sessions" && request.method() === "GET") {
    await fulfillJson(route, [
      {
        id: 1,
        current: true,
        createdAt: "2024-04-20T08:00:00.000Z",
        expiresAt: "2024-04-27T08:00:00.000Z",
      },
    ]);
    return true;
  }

  if (pathname === "/api/auth/two-factor/status") {
    await fulfillJson(route, {
      enabled: Boolean(state.user.twoFactorEnabled),
      available: state.user.authProvider === "local",
      emailVerified: Boolean(state.user.emailVerified),
    });
    return true;
  }

  if (pathname === "/api/auth/two-factor/setup") {
    state.twoFactorSetupCount += 1;
    state.twoFactorChallengeToken = `setup-challenge-${state.twoFactorSetupCount}`;
    await fulfillJson(route, {
      twoFactorRequired: true,
      challengeToken: state.twoFactorChallengeToken,
      expiresInSeconds: 600,
    });
    return true;
  }

  if (pathname === "/api/auth/two-factor/enable") {
    const payload = request.postDataJSON() as {
      challengeToken?: string;
      code?: string;
    };
    state.lastTwoFactorCode = payload.code ?? null;
    if (
      payload.challengeToken !== state.twoFactorChallengeToken ||
      payload.code !== "123456"
    ) {
      await fulfillJson(
        route,
        { message: "Invalid verification code" },
        { status: 401 },
      );
      return true;
    }
    state.user.twoFactorEnabled = true;
    state.twoFactorChallengeToken = null;
    await fulfillJson(route, { success: true });
    return true;
  }

  if (pathname === "/api/auth/two-factor/disable") {
    state.user.twoFactorEnabled = false;
    await fulfillJson(route, { success: true });
    return true;
  }

  if (pathname === "/api/auth/two-factor/verify") {
    const payload = request.postDataJSON() as {
      challengeToken?: string;
      code?: string;
    };
    state.lastTwoFactorCode = payload.code ?? null;
    if (
      payload.challengeToken !== state.twoFactorChallengeToken ||
      payload.code !== "123456"
    ) {
      await fulfillJson(
        route,
        { message: "Invalid verification code" },
        { status: 401 },
      );
      return true;
    }
    state.authenticated = true;
    state.twoFactorChallengeToken = null;
    await fulfillJson(route, {
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token",
      user: state.user,
    });
    return true;
  }

  if (pathname === "/api/auth/two-factor/resend") {
    state.twoFactorSetupCount += 1;
    state.twoFactorChallengeToken = `challenge-${state.twoFactorSetupCount}`;
    await fulfillJson(route, {
      twoFactorRequired: true,
      challengeToken: state.twoFactorChallengeToken,
      expiresInSeconds: 600,
    });
    return true;
  }

  if (pathname === "/api/auth/verify-email") {
    const payload = request.postDataJSON() as { token?: string };
    state.lastVerificationToken = payload.token ?? null;
    if (!payload.token || payload.token === "expired-token") {
      await fulfillJson(
        route,
        { message: "Invalid or expired verification token" },
        { status: 400 },
      );
      return true;
    }

    state.user.emailVerified = true;
    await fulfillJson(route, {
      success: true,
      message: "Email verified successfully",
    });
    return true;
  }

  if (pathname === "/api/auth/resend-verification-email") {
    state.verificationResendCount += 1;
    await fulfillJson(route, {
      success: true,
      message: "Verification email sent",
    });
    return true;
  }

  if (pathname === "/api/auth/register") {
    const payload = request.postDataJSON() as {
      email?: string;
      username?: string;
    };
    state.lastRegisterPayload = payload;
    state.authenticated = true;
    state.user = {
      id: 1,
      username: payload.username || "NewUser",
      email: payload.email || "new@example.com",
      fullName: payload.username || "NewUser",
      authProvider: "local",
      emailVerified: false,
    };

    await fulfillJson(route, {
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token",
      user: state.user,
    });
    return true;
  }

  if (pathname === "/api/auth/login") {
    state.lastLoginPayload = request.postDataJSON();
    if (state.user.twoFactorEnabled) {
      state.twoFactorChallengeToken = "login-challenge";
      await fulfillJson(route, {
        twoFactorRequired: true,
        challengeToken: state.twoFactorChallengeToken,
        expiresInSeconds: 600,
      });
      return true;
    }
    state.authenticated = true;

    await fulfillJson(route, {
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token",
      user: state.user,
    });
    return true;
  }

  if (pathname === "/api/auth/me") {
    if (!state.authenticated) {
      await fulfillJson(route, { error: "Unauthorized" }, { status: 401 });
      return true;
    }

    await fulfillJson(route, state.user);
    return true;
  }

  return false;
}

async function handleConfigRoutes({
  route,
  request,
  pathname,
  state,
}: RouteContext): Promise<boolean> {
  if (pathname === "/api/config") {
    if (request.method() === "POST") {
      state.config = {
        ...state.config,
        ...(request.postDataJSON() as Record<string, unknown>),
      };
    }

    await fulfillJson(route, state.config);
    return true;
  }

  if (pathname === "/api/config/profile-stats") {
    const years = state.entries.map((entry) => Number(entry.date.slice(0, 4)));

    await fulfillJson(route, {
      totalEntries: state.entries.length,
      uniqueTags: unique(state.entries.flatMap((entry) => entry.tags)).length,
      firstEntryYear: years.length > 0 ? Math.min(...years) : 2024,
    });
    return true;
  }

  return false;
}

async function handleFeatureRequestRoutes({
  route,
  request,
  pathname,
  state,
}: RouteContext): Promise<boolean> {
  if (pathname === "/api/feature-requests/votes") {
    await fulfillJson(route, { requestIds: state.featureRequestVotes });
    return true;
  }

  if (pathname === "/api/feature-requests") {
    if (request.method() === "POST") {
      const payload = request.postDataJSON() as {
        title: string;
        details: string;
      };
      state.lastFeatureRequestPayload = payload;
      const featureRequest = {
        id: Math.max(0, ...state.featureRequests.map((idea) => idea.id)) + 1,
        title: payload.title,
        details: payload.details,
        status: "open" as const,
        votes: 1,
        createdAt: "2026-07-23T19:30:00.000Z",
      };
      state.featureRequests.push(featureRequest);
      state.featureRequestVotes.push(featureRequest.id);
      await fulfillJson(route, featureRequest, { status: 201 });
      return true;
    }

    await fulfillJson(route, {
      requests: [...state.featureRequests].sort(
        (left, right) => right.votes - left.votes,
      ),
    });
    return true;
  }

  const voteMatch = /^\/api\/feature-requests\/(\d+)\/vote$/.exec(pathname);
  if (voteMatch && request.method() === "POST") {
    const requestId = Number(voteMatch[1]);
    const featureRequest = state.featureRequests.find(
      (idea) => idea.id === requestId,
    );
    if (!featureRequest) {
      await fulfillJson(
        route,
        { message: "Feature request not found" },
        { status: 404 },
      );
      return true;
    }
    if (!state.featureRequestVotes.includes(requestId)) {
      state.featureRequestVotes.push(requestId);
      featureRequest.votes += 1;
    }
    await fulfillJson(
      route,
      { requestId, votes: featureRequest.votes, voted: true },
      { status: 201 },
    );
    return true;
  }

  return false;
}

export async function registerMockAppRoutes(page: Page, state: MockAppState) {
  await page.route("http://localhost:5173/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const context: RouteContext = {
      route,
      request,
      url,
      pathname: url.pathname,
      searchParams: url.searchParams,
      state,
    };

    if (await handleAuthRoutes(context)) {
      return;
    }
    if (await handleConfigRoutes(context)) {
      return;
    }
    if (await handleAiCredentialRoutes(context)) {
      return;
    }
    if (await handleFeatureRequestRoutes(context)) {
      return;
    }
    if (await handleReferenceRoutes(context)) {
      return;
    }
    if (await handleIoRoutes(context)) {
      return;
    }
    if (await handleBookRoutes(context)) {
      return;
    }
    if (await handleCloudSyncRoutes(context)) {
      return;
    }
    if (await handleSocialRoutes(context)) {
      return;
    }
    if (await handleEntriesRoutes(context)) {
      return;
    }

    await fulfillJson(route, { success: true });
  });
}
