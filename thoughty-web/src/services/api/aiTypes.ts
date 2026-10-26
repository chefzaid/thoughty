export const rephraseModes = ["grammar", "polish", "rewrite"] as const;

export type RephraseMode = (typeof rephraseModes)[number];

export interface SummaryGuidance {
  includeDetails?: string;
  excludeDetails?: string;
}

export interface DuplicateEntryPreview {
  id: number;
  date: string;
  index: number;
  diaryId: number | null;
  content: string;
  tags: string[];
}

export interface DuplicateEntryGroup {
  confidence: number;
  reason: string;
  entries: DuplicateEntryPreview[];
}

export interface DuplicateEntryScan {
  analyzedEntries: number;
  totalEntries: number;
  truncated: boolean;
  groups: DuplicateEntryGroup[];
}

export interface SemanticSearchMatch {
  entryId: number;
  score: number;
}

export interface SemanticSearchResponse {
  analyzedEntries: number;
  totalEntries: number;
  truncated: boolean;
  matches: SemanticSearchMatch[];
}

export type JournalRetagMode = "replace" | "add";

export interface JournalRetagEntry {
  id: number;
  date: string;
  index: number;
  currentTags: string[];
  suggestedTags: string[];
}

export interface JournalRetagPlan {
  analyzedEntries: number;
  totalEntries: number;
  truncated: boolean;
  themes: string[];
  entries: JournalRetagEntry[];
}

export interface OpenRouterCredentialStatus {
  hasPersonalKey: boolean;
  keyHint: string | null;
  source: "personal" | "server" | "none";
  aiAvailable: boolean;
}

export interface OpenRouterUsageDashboard {
  provider: {
    label: string | null;
    usage: number;
    usageDaily: number;
    usageWeekly: number;
    usageMonthly: number;
    limit: number | null;
    limitRemaining: number | null;
    limitReset: "daily" | "weekly" | "monthly" | null;
    expiresAt: string | null;
  };
  thoughty: {
    promptTokens: number;
    completionTokens: number;
    reasoningTokens: number;
    totalTokens: number;
    cost: number;
    requests: number;
    periodDays: number;
  };
}

export interface AiApiResult<T> {
  data: T | null;
  error: string | null;
}

export type AiAuthFetch = (url: string, options?: RequestInit) => Promise<Response>;
