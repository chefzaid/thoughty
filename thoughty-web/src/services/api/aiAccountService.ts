import { readApiErrorMessage, safeJsonParse } from "./base";
import type {
  AiApiResult,
  AiAuthFetch,
  OpenRouterCredentialStatus,
  OpenRouterUsageDashboard,
} from "./aiTypes";

/** The account's AI setup: available models, the OpenRouter key and usage. */
export const createAiAccountService = (authFetch: AiAuthFetch) => {
  const fetchModels = async (): Promise<{ id: string; name: string }[]> => {
    try {
      const response = await authFetch("/api/ai/models");
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("Error fetching models:", error);
      return [];
    }
  };

  const getCredentialStatus =
    async (): Promise<OpenRouterCredentialStatus | null> => {
      try {
        const response = await authFetch("/api/ai/credentials");
        const data = await safeJsonParse<OpenRouterCredentialStatus>(response);
        return response.ok ? data : null;
      } catch (error) {
        console.error("Error loading OpenRouter credential status:", error);
        return null;
      }
    };

  const updateCredential = async (
    apiKey: string,
  ): Promise<AiApiResult<OpenRouterCredentialStatus>> => {
    try {
      const response = await authFetch("/api/ai/credentials", {
        method: "PUT",
        body: JSON.stringify({ apiKey }),
      });
      if (!response.ok) {
        return {
          data: null,
          error: await readApiErrorMessage(response, "apiKeySaveError"),
        };
      }
      return {
        data: await safeJsonParse<OpenRouterCredentialStatus>(response),
        error: null,
      };
    } catch (error) {
      console.error("Error saving OpenRouter credential:", error);
      return { data: null, error: "apiKeySaveError" };
    }
  };

  const removeCredential = async (): Promise<
    AiApiResult<OpenRouterCredentialStatus>
  > => {
    try {
      const response = await authFetch("/api/ai/credentials", {
        method: "DELETE",
      });
      if (!response.ok) {
        return {
          data: null,
          error: await readApiErrorMessage(
            response,
            "apiKeyRemoveError",
          ),
        };
      }
      return {
        data: await safeJsonParse<OpenRouterCredentialStatus>(response),
        error: null,
      };
    } catch (error) {
      console.error("Error removing OpenRouter credential:", error);
      return { data: null, error: "apiKeyRemoveError" };
    }
  };

  const getUsageDashboard = async (): Promise<
    AiApiResult<OpenRouterUsageDashboard>
  > => {
    try {
      const response = await authFetch("/api/ai/usage");
      if (!response.ok) {
        return {
          data: null,
          error: await readApiErrorMessage(response, "Could not load usage"),
        };
      }
      return {
        data: await safeJsonParse<OpenRouterUsageDashboard>(response),
        error: null,
      };
    } catch (error) {
      console.error("Error loading OpenRouter usage:", error);
      return { data: null, error: "Could not load usage" };
    }
  };

  return {
    fetchModels,
    getCredentialStatus,
    updateCredential,
    removeCredential,
    getUsageDashboard,
  };
};
