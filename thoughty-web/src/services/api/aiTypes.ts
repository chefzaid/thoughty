import type { components } from "../../generated/openapi";

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

export type AiAuthFetch = (url: string, options?: RequestInit) => Promise<Response>;
