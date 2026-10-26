import { readApiErrorMessage, safeJsonParse } from "./base";
import type {
  AiApiResult,
  AiAuthFetch,
  DuplicateEntryScan,
  JournalRetagMode,
  JournalRetagPlan,
  SemanticSearchResponse,
} from "./aiTypes";

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isJournalRetagPlan(value: unknown): value is JournalRetagPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<JournalRetagPlan>;
  return (
    Number.isInteger(plan.analyzedEntries) &&
    (plan.analyzedEntries ?? -1) >= 0 &&
    Number.isInteger(plan.totalEntries) &&
    (plan.totalEntries ?? -1) >= 0 &&
    typeof plan.truncated === "boolean" &&
    isStringArray(plan.themes) &&
    plan.themes.length <= 12 &&
    Array.isArray(plan.entries) &&
    plan.entries.length <= 300 &&
    plan.entries.every(
      (entry) =>
        Number.isInteger(entry.id) &&
        entry.id > 0 &&
        typeof entry.date === "string" &&
        Number.isInteger(entry.index) &&
        entry.index > 0 &&
        isStringArray(entry.currentTags) &&
        isStringArray(entry.suggestedTags) &&
        entry.suggestedTags.length <= 3,
    )
  );
}

/** AI analysis across the whole journal: duplicates, search by meaning and retagging. */
export const createAiJournalService = (authFetch: AiAuthFetch) => {
  const findDuplicateEntries = async (
    diaryId?: number,
  ): Promise<DuplicateEntryScan | null> => {
    try {
      const response = await authFetch("/api/ai/duplicates", {
        method: "POST",
        body: JSON.stringify(diaryId == null ? {} : { diaryId }),
      });
      const data = await safeJsonParse<DuplicateEntryScan>(response);
      if (
        !response.ok ||
        !data ||
        !Number.isInteger(data.analyzedEntries) ||
        !Number.isInteger(data.totalEntries) ||
        typeof data.truncated !== "boolean" ||
        !Array.isArray(data.groups)
      )
        return null;

      return data;
    } catch (error) {
      console.error("Error finding duplicate entries:", error);
      return null;
    }
  };

  const semanticSearch = async (
    query: string,
    diaryId?: number,
  ): Promise<SemanticSearchResponse | null> => {
    try {
      const response = await authFetch("/api/ai/semantic-search", {
        method: "POST",
        body: JSON.stringify({
          query,
          ...(diaryId == null ? {} : { diaryId }),
        }),
      });
      const data = await safeJsonParse<SemanticSearchResponse>(response);
      if (
        !response.ok ||
        !data ||
        !Number.isInteger(data.analyzedEntries) ||
        !Number.isInteger(data.totalEntries) ||
        typeof data.truncated !== "boolean" ||
        !Array.isArray(data.matches) ||
        data.matches.some(
          (match) =>
            !Number.isInteger(match.entryId) ||
            match.entryId < 1 ||
            !Number.isFinite(match.score) ||
            match.score < -1 ||
            match.score > 1,
        )
      )
        return null;

      return data;
    } catch (error) {
      console.error("Error searching entries by meaning:", error);
      return null;
    }
  };

  const previewJournalRetag = async (): Promise<
    AiApiResult<JournalRetagPlan>
  > => {
    try {
      const response = await authFetch("/api/ai/journal-retag/preview", {
        method: "POST",
      });
      if (!response.ok) {
        return {
          data: null,
          error: await readApiErrorMessage(
            response,
            "journalRetagError",
          ),
        };
      }
      const data = await safeJsonParse<unknown>(response);
      return isJournalRetagPlan(data)
        ? { data, error: null }
        : { data: null, error: "journalRetagError" };
    } catch (error) {
      console.error("Error creating journal retag plan:", error);
      return { data: null, error: "journalRetagError" };
    }
  };

  const applyJournalRetag = async (
    mode: JournalRetagMode,
    assignments: Array<{ entryId: number; tags: string[] }>,
  ): Promise<AiApiResult<{ success: boolean; affectedEntries: number }>> => {
    try {
      const response = await authFetch("/api/ai/journal-retag/apply", {
        method: "POST",
        body: JSON.stringify({ mode, assignments }),
      });
      if (!response.ok) {
        return {
          data: null,
          error: await readApiErrorMessage(
            response,
            "journalRetagApplyError",
          ),
        };
      }
      const data = await safeJsonParse<unknown>(response);
      if (
        !data ||
        typeof data !== "object" ||
        (data as { success?: unknown }).success !== true ||
        !Number.isInteger(
          (data as { affectedEntries?: unknown }).affectedEntries,
        )
      ) {
        return { data: null, error: "journalRetagApplyError" };
      }
      return {
        data: data as { success: boolean; affectedEntries: number },
        error: null,
      };
    } catch (error) {
      console.error("Error applying journal retag plan:", error);
      return { data: null, error: "journalRetagApplyError" };
    }
  };

  return {
    findDuplicateEntries,
    semanticSearch,
    previewJournalRetag,
    applyJournalRetag,
  };
};
