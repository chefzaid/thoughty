import type { components } from "../../generated/openapi";
import { safeJsonParse } from "./base";
import type { AiAuthFetch, RephraseMode, SummaryGuidance } from "./aiTypes";

/** AI help while writing and reading one entry: tags, rephrasing, summaries, prompts and chat. */
export const createAiWritingService = (authFetch: AiAuthFetch) => {
  const suggestTags = async (
    content: string,
    existingTags: string[] = [],
    maxTags = 5,
  ): Promise<string[] | null> => {
    try {
      const response = await authFetch("/api/ai/suggest-tags", {
        method: "POST",
        body: JSON.stringify({
          content,
          existingTags,
          maxTags,
        }),
      });

      const data = await safeJsonParse<components["schemas"]["SuggestTagsResponseDto"]>(response);
      if (!response.ok || !data) {
        return null;
      }

      return Array.isArray(data.tags) ? data.tags : [];
    } catch (error) {
      console.error("Error suggesting tags:", error);
      return null;
    }
  };

  const fixWriting = async (
    content: string,
    mode: RephraseMode = "grammar",
  ): Promise<string | null> => {
    try {
      const response = await authFetch("/api/ai/fix-writing", {
        method: "POST",
        body: JSON.stringify({ content, mode }),
      });

      const data = await safeJsonParse<components["schemas"]["FixWritingResponseDto"]>(response);
      if (!response.ok || !data) {
        return null;
      }

      return typeof data.content === "string" ? data.content : null;
    } catch (error) {
      console.error("Error fixing writing:", error);
      return null;
    }
  };

  const chat = async (
    entryId: number,
    entryContent: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
  ): Promise<string | null> => {
    try {
      const response = await authFetch("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ entryId, entryContent, messages }),
      });

      const data = await safeJsonParse<{ reply?: string }>(response);
      if (!response.ok || !data) {
        return null;
      }

      return typeof data.reply === "string" ? data.reply : null;
    } catch (error) {
      console.error("Error in AI chat:", error);
      return null;
    }
  };

  const summarizeEntry = async (
    entryId: number,
    guidance: SummaryGuidance = {},
  ): Promise<string | null> => {
    try {
      const response = await authFetch("/api/ai/summarize", {
        method: "POST",
        body: JSON.stringify({ entryId, ...guidance }),
      });

      const data = await safeJsonParse<{ summary?: string }>(response);
      if (!response.ok || !data) {
        return null;
      }

      return typeof data.summary === "string" && data.summary.trim()
        ? data.summary
        : null;
    } catch (error) {
      console.error("Error summarizing entry:", error);
      return null;
    }
  };

  const getInspiration = async (diaryId?: number): Promise<string | null> => {
    try {
      const response = await authFetch("/api/ai/inspiration", {
        method: "POST",
        body: JSON.stringify(diaryId == null ? {} : { diaryId }),
      });

      const data = await safeJsonParse<{ question?: unknown }>(response);
      if (!response.ok || typeof data?.question !== "string") {
        return null;
      }

      return data.question.trim() || null;
    } catch (error) {
      console.error("Error getting inspiration:", error);
      return null;
    }
  };

  const getChatHistory = async (
    entryId: number,
  ): Promise<Array<{ role: "user" | "assistant"; content: string }>> => {
    try {
      const response = await authFetch(`/api/ai/history/${entryId}`);
      const data = await safeJsonParse<{
        messages?: Array<{ role?: string; content?: string }>;
      }>(response);

      if (!response.ok || !data || !Array.isArray(data.messages)) {
        return [];
      }

      return data.messages.filter(
        (message): message is { role: "user" | "assistant"; content: string } =>
          typeof message === "object" &&
          message !== null &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string",
      );
    } catch (error) {
      console.error("Error loading AI chat history:", error);
      return [];
    }
  };

  return {
    suggestTags,
    fixWriting,
    summarizeEntry,
    getInspiration,
    chat,
    getChatHistory,
  };
};
