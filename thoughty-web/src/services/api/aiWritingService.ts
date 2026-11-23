import type { components } from "../../generated/openapi";
import { readApiErrorKey, safeJsonParse } from "./base";
import type { AiAnswer, AiAuthFetch, RephraseMode, SummaryGuidance } from "./aiTypes";

/** The diary a text is written in, which the server checks for AI off; none is left out of the request. */
const inDiary = (diaryId: number | null | undefined) => (diaryId == null ? {} : { diaryId });

/** The writer's consent, which a diary that asks before each AI request needs; left out otherwise. */
const withConsent = (aiConsent: boolean | undefined) => (aiConsent ? { aiConsent: true } : {});

const answer = <T>(data: T): AiAnswer<T> => ({ data, refusal: null });
const NO_ANSWER: AiAnswer<never> = { data: null, refusal: null };

/** No answer from a failed request, with the refusal its error code names. */
const refused = async (response: Response): Promise<AiAnswer<never>> => ({
  data: null,
  refusal: await readApiErrorKey(response),
});

/** AI help while writing and reading one entry: tags, rephrasing, summaries, prompts and chat. */
export const createAiWritingService = (authFetch: AiAuthFetch) => {
  const suggestTags = async (
    content: string,
    existingTags: string[] = [],
    maxTags = 5,
    diaryId?: number | null,
    aiConsent?: boolean,
  ): Promise<AiAnswer<string[]>> => {
    try {
      const response = await authFetch("/api/ai/suggest-tags", {
        method: "POST",
        body: JSON.stringify({
          content,
          existingTags,
          maxTags,
          ...inDiary(diaryId),
          ...withConsent(aiConsent),
        }),
      });
      if (!response.ok) {
        return await refused(response);
      }

      const data = await safeJsonParse<components["schemas"]["SuggestTagsResponseDto"]>(response);
      if (!data) {
        return NO_ANSWER;
      }

      return answer(Array.isArray(data.tags) ? data.tags : []);
    } catch (error) {
      console.error("Error suggesting tags:", error);
      return NO_ANSWER;
    }
  };

  const fixWriting = async (
    content: string,
    mode: RephraseMode = "grammar",
    diaryId?: number | null,
    aiConsent?: boolean,
  ): Promise<AiAnswer<string>> => {
    try {
      const response = await authFetch("/api/ai/fix-writing", {
        method: "POST",
        body: JSON.stringify({ content, mode, ...inDiary(diaryId), ...withConsent(aiConsent) }),
      });
      if (!response.ok) {
        return await refused(response);
      }

      const data = await safeJsonParse<components["schemas"]["FixWritingResponseDto"]>(response);
      return typeof data?.content === "string" ? answer(data.content) : NO_ANSWER;
    } catch (error) {
      console.error("Error fixing writing:", error);
      return NO_ANSWER;
    }
  };

  const chat = async (
    entryId: number,
    entryContent: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    aiConsent?: boolean,
  ): Promise<string | null> => {
    try {
      const response = await authFetch("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ entryId, entryContent, messages, ...withConsent(aiConsent) }),
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
    aiConsent?: boolean,
  ): Promise<string | null> => {
    try {
      const response = await authFetch("/api/ai/summarize", {
        method: "POST",
        body: JSON.stringify({ entryId, ...guidance, ...withConsent(aiConsent) }),
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
