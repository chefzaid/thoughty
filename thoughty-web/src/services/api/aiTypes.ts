import type { components } from "../../generated/openapi";
import type { ApiErrorTranslationKey } from "../../utils/translations.apiErrors";
import type { LocalModelProblem } from "../localModel/localModelClient";

export const rephraseModes = ["grammar", "polish", "rewrite"] as const;

export type RephraseMode = (typeof rephraseModes)[number];

export interface SummaryGuidance {
  includeDetails?: string;
  excludeDetails?: string;
}

type Schemas = components["schemas"];

// Response bodies, derived from the API contract so a renamed field fails the type check
export type DuplicateEntryPreview = Schemas["DuplicateEntryPreviewDto"];
export type DuplicateEntryGroup = Schemas["DuplicateEntryGroupDto"];
export type DuplicateEntryScan = Schemas["DuplicateEntryScanResponseDto"];
export type SemanticSearchMatch = Schemas["SemanticSearchMatchDto"];
export type SemanticSearchResponse = Schemas["SemanticSearchResponseDto"];

export type JournalRetagMode = "replace" | "add";

export type JournalRetagEntry = Schemas["JournalRetagEntryDto"];
export type JournalRetagPlan = Schemas["JournalRetagPlanResponseDto"];
export type OpenRouterCredentialStatus = Schemas["OpenRouterCredentialStatusDto"];
export type OpenRouterUsageDashboard = Schemas["OpenRouterUsageDashboardDto"];

export interface AiApiResult<T> {
  data: T | null;
  error: string | null;
}

/**
 * An AI answer, or why there is none: `refusal` is the translation key of the API's error code
 * (`apiError_<CODE>`, such as `apiError_DIARY_AI_OFF`) when the app knows it, or of what went wrong with the
 * writer's own model (`localModel<Problem>`), else null (no answer, a network failure, an unknown error), for the
 * screen to show its own message.
 */
export type AiAnswer<T> = { data: T; refusal: null } | { data: null; refusal: ApiErrorTranslationKey | LocalModelProblem | null };

export type AiAuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

/**
 * Why an AI action gave no answer, when the screen should say it in place of its own message: the translation key
 * of a refusal (`AiAnswer['refusal']`), such as what went wrong with the writer's own model.
 */
export interface AiProblem {
  readonly problem: string;
}

/** Whether an AI action's result is the reason it gave no answer. */
export const isAiProblem = (value: unknown): value is AiProblem =>
  typeof value === 'object' && value !== null && typeof (value as { problem?: unknown }).problem === 'string';
