import { fulfillApiError, fulfillJson, type RouteContext } from "./mockApp.route-utils";

// A few of the models OpenRouter lists; the API passes them on as `{ id, name }`, sorted by name.
const OPENROUTER_MODELS = [
  { id: "openai/gpt-4o-mini", name: "OpenAI: GPT-4o-mini" },
  { id: "anthropic/claude-3.5-haiku", name: "Anthropic: Claude 3.5 Haiku" },
  { id: "mistralai/mistral-small-3.1-24b-instruct", name: "Mistral: Mistral Small 3.1 24B" },
];

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
        await fulfillApiError(route, 400, "AI_KEY_REJECTED", "OpenRouter rejected this API key");
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

  // The mock always has a server key to fall back on, so the model list is always there.
  if (pathname === "/api/ai/models" && request.method() === "GET") {
    await fulfillJson(
      route,
      [...OPENROUTER_MODELS].sort((left, right) => left.name.localeCompare(right.name)),
    );
    return true;
  }

  if (pathname === "/api/ai/usage") {
    if (!state.personalOpenRouterKey) {
      await fulfillApiError(route, 400, "AI_PERSONAL_KEY_REQUIRED", "Add a personal OpenRouter API key to view usage");
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
