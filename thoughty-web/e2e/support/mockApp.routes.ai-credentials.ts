import { fulfillJson, type RouteContext } from "./mockApp.route-utils";

export async function handleAiCredentialRoutes({
  route,
  request,
  pathname,
  state,
}: RouteContext): Promise<boolean> {
  if (pathname === "/api/ai/credentials") {
    if (request.method() === "PUT") {
      const payload = request.postDataJSON() as { apiKey?: string };
      state.lastOpenRouterKeyPayload = payload;
      if (!payload.apiKey?.startsWith("sk-or-v1-")) {
        await fulfillJson(
          route,
          { message: "OpenRouter rejected this API key" },
          { status: 400 },
        );
        return true;
      }
      state.personalOpenRouterKey = payload.apiKey;
    } else if (request.method() === "DELETE") {
      state.personalOpenRouterKey = null;
    }

    await fulfillJson(
      route,
      state.personalOpenRouterKey
        ? {
            hasPersonalKey: true,
            keyHint: `...${state.personalOpenRouterKey.slice(-5)}`,
            source: "personal",
            aiAvailable: true,
          }
        : {
            hasPersonalKey: false,
            keyHint: null,
            source: "server",
            aiAvailable: true,
          },
    );
    return true;
  }

  if (pathname === "/api/ai/usage") {
    if (!state.personalOpenRouterKey) {
      await fulfillJson(
        route,
        { message: "Add a personal OpenRouter API key to view usage" },
        { status: 400 },
      );
      return true;
    }
    await fulfillJson(route, {
      provider: {
        label: "Thoughty personal",
        usage: 3.75,
        usageDaily: 0.15,
        usageWeekly: 0.8,
        usageMonthly: 2.1,
        limit: 10,
        limitRemaining: 6.25,
        limitReset: "monthly",
        expiresAt: null,
      },
      thoughty: {
        promptTokens: 1200,
        completionTokens: 300,
        reasoningTokens: 40,
        totalTokens: 1500,
        cost: 0.05,
        requests: 4,
        periodDays: 30,
      },
    });
    return true;
  }

  return false;
}
