import { createMockMemoirState, type MockMemoirProgram, type MockMemoirState } from "./mockApp.memoir";
import { createMockAppImportState, type MockAppImportState } from "./mockApp.app-import";
import { createMockReviewState, type MockReviewState } from "./mockApp.review";
import type { MockSavedSearch } from "./mockApp.routes.saved-searches";
import type { MockLifeEra } from "./mockApp.routes.life-eras";
import { createMockOptInEmail, type MockOptInEmail } from "./mockApp.routes.opt-in-emails";
import { addMockMentionedPeople, type MockPerson } from "./mockApp.routes.people";
import type { MockDiary } from "./mockApp.diaries";
import type { components } from "../../src/generated/openapi";
import {
  DEFAULT_CLOUD_FILES,
  DEFAULT_CLOUD_SCHEDULES,
  DEFAULT_CLOUD_STATUS,
  DEFAULT_DIARIES,
  DEFAULT_FEATURE_REQUESTS,
} from "./mockApp.defaults";

type AuthPayload = {
  email?: string;
  password?: string;
  username?: string;
  identifier?: string;
};

export type MockCloudProvider = "google_drive" | "onedrive" | "dropbox";

export interface MockCloudProviderStatus {
  connected: boolean;
  connectedAt?: string;
}

export interface MockCloudSchedule {
  enabled: boolean;
  frequency?: "every_6h" | "every_12h" | "daily" | "weekly";
  format?: "txt" | "json" | "md";
  diaryId?: number;
  includeVisibility?: boolean;
  lastSyncAt?: string;
  lastSyncHash?: string;
  nextSyncAt?: string;
}

export interface MockCloudFile {
  id: string;
  provider: MockCloudProvider;
  name: string;
  size: number;
  modifiedAt: string;
  content?: string;
}

export interface MockEntry {
  id: number;
  userId?: number;
  authorUsername?: string;
  authorAvatarUrl?: string | null;
  date: string;
  index: number;
  /** Optional one-line title. */
  title?: string | null;
  /** Optional time of day, `HH:MM`. */
  time_of_day?: string | null;
  /** Optional mood from 1 (very low) to 5 (very good), and feeling words. */
  mood?: number | null;
  feelings?: string[];
  content: string;
  tags: string[];
  visibility: "public" | "private";
  is_favorite?: boolean;
  is_archived?: boolean;
  moderationStatus?: "visible" | "hidden" | "under_review" | "removed";
  /** Likes by other users, before the current user's own like. */
  likeCount?: number;
  createdAt?: string;
  format?: "plain" | "markdown";
  diaryId?: number | null;
  attachments?: Array<{
    id: number;
    original_filename: string;
    stored_filename: string;
    mimetype: string;
    size: number;
    transcript?: string | null;
    transcribed_at?: string | null;
  }>;
}

/** An entry in the recycle bin, with when it was deleted. */
export interface MockTrashedEntry extends MockEntry {
  deletedAt: string;
}

export interface MockEntryRevision {
  id: number;
  entryId: number;
  content: string;
  title?: string | null;
  timeOfDay?: string | null;
  mood?: number | null;
  feelings?: string[];
  tags: string[];
  date: string;
  format: "plain" | "markdown";
  visibility: "public" | "private";
  createdAt: string;
}

export interface MockFeatureRequest {
  id: number;
  title: string;
  details: string;
  status: "open" | "reviewing" | "planned";
  votes: number;
  createdAt: string;
}

export interface MockComment {
  id: number;
  entryId: number;
  userId: number;
  username: string;
  content: string;
  createdAt: string;
  /** Likes by other users, before the current user's own like. */
  likeCount?: number;
}

export interface MockBookVersion {
  id: number;
  versionNumber: number;
  title: string;
  format: "pdf" | "epub" | "html" | "md";
  filename: string;
  chapterCount: number;
  entryCount: number;
  addedEntryCount: number;
  addedChapterTitles: string[];
  source: components["schemas"]["BookVersionSourceDto"];
  createdAt: string;
}

export interface SetupMockAppOptions {
  startAuthenticated?: boolean;
  initialEntries?: MockEntry[];
  initialRevisions?: Record<number, MockEntryRevision[]>;
  /** Entries already in the recycle bin. */
  initialTrash?: MockTrashedEntry[];
  config?: Partial<MockAppState["config"]>;
  diaries?: MockAppState["diaries"];
  cloudStatus?: MockAppState["cloudStatus"];
  cloudSchedules?: MockAppState["cloudSchedules"];
  cloudFiles?: MockCloudFile[];
  followedUserIds?: number[];
  followerCount?: number;
  comments?: MockComment[];
  likedEntryIds?: number[];
  likedCommentIds?: number[];
  /** A started guided memoir (defaults filled in), or null/omitted for one not started yet. */
  memoirProgram?: Partial<MockMemoirProgram> | null;
  savedSearches?: MockSavedSearch[];
  lifeEras?: MockLifeEra[];
  /** The saved "On this day" email setting; off and never saved by default. */
  onThisDayEmail?: Partial<MockOptInEmail>;
  /** The saved monthly recap email setting; off and never saved by default. */
  monthlyRecapEmail?: Partial<MockOptInEmail>;
  /** The people the writer mentions; by default those the initial entries mention. */
  people?: MockPerson[];
}

export interface MockAppState {
  authenticated: boolean;
  /** The signed-in user exactly as a new session reports it. */
  user: components["schemas"]["AuthUserDto"];
  config: {
    theme: "light" | "dark";
    language: "en" | "fr";
    entriesPerPage: number;
    autoTagMaxTags?: string | number;
    name?: string;
    bio?: string;
    email?: string;
    fontFamily?: "system" | "serif" | "modern" | "mono";
    fontSize?: string | number;
    fontColor?: string;
    highContrast?: boolean | string;
    readDates?: boolean;
    streakCard?: boolean;
    ttsVoiceUri?: string;
    openRouterModel?: string;
  };
  diaries: MockDiary[];
  entries: MockEntry[];
  trash: MockTrashedEntry[];
  revisions: Record<number, MockEntryRevision[]>;
  cloudStatus: Record<MockCloudProvider, MockCloudProviderStatus>;
  cloudSchedules: Partial<Record<MockCloudProvider, MockCloudSchedule>>;
  cloudFiles: MockCloudFile[];
  featureRequests: MockFeatureRequest[];
  featureRequestVotes: number[];
  followedUserIds: number[];
  followerCount: number;
  comments: MockComment[];
  likedEntryIds: number[];
  likedCommentIds: number[];
  bookVersions: MockBookVersion[];
  /** What each saved version held, so the next one can count what it adds. */
  bookVersionManifests: Record<number, { entryIds: number[]; chapterTitles: string[] }>;
  savedSearches: MockSavedSearch[];
  lifeEras: MockLifeEra[];
  onThisDayEmail: MockOptInEmail;
  monthlyRecapEmail: MockOptInEmail;
  people: MockPerson[];
  memoir: MockMemoirState;
  appImport: MockAppImportState;
  review: MockReviewState;
  nextEntryId: number;
  lastLoginPayload: AuthPayload | null;
  lastRegisterPayload: AuthPayload | null;
  lastVerificationToken: string | null;
  verificationResendCount: number;
  twoFactorSetupCount: number;
  twoFactorChallengeToken: string | null;
  lastTwoFactorCode: string | null;
  lastPreviewPayload: unknown;
  lastImportPayload: unknown;
  lastFormatPayload: unknown;
  lastDeleteAllRequestUrl: URL | null;
  lastExportRequestUrl: URL | null;
  lastBookUploadRequestUrl: URL | null;
  lastBookUploadRequestBody: string | null;
  lastBookVersionRequestUrl: URL | null;
  lastBookPreviewRequestUrl: URL | null;
  lastBookVersionDownloadId: number | null;
  lastAiSuggestionPayload: unknown;
  lastAiFixPayload: unknown;
  lastAiSummaryPayload: unknown;
  lastPersonalityAnalysisPayload: unknown;
  lastFeatureRequestPayload: unknown;
  lastAiInspirationPayload: unknown;
  lastAiDuplicatePayload: unknown;
  lastAiSemanticSearchPayload: unknown;
  lastAiChatPayload: unknown;
  lastAiJournalRetagPayload: unknown;
  personalOpenRouterKey: string | null;
  lastOpenRouterKeyPayload: unknown;
  lastBulkPayload: unknown;
  lastReorderPayload: unknown;
  /** Every task tick sent, in order. */
  taskRequests: Array<{ entryId: number; line: number; checked: boolean }>;
  lastCloudFilesRequestUrl: URL | null;
  lastCloudUploadPayload: unknown;
  lastCloudDownloadPayload: unknown;
  lastCloudSchedulePayload: unknown;
  lastCloudSyncPayload: unknown;
  lastCloudDeleteScheduleProvider: string | null;
}

export const DEFAULT_FORMAT_CONFIG: components["schemas"]["FormatConfigResponseDto"] = {
  entrySeparator:
    "--------------------------------------------------------------------------------",
  sameDaySeparator:
    "********************************************************************************",
  datePrefix: "---",
  dateSuffix: "--",
  dateFormat: "YYYY-MM-DD",
  tagOpenBracket: "[",
  tagCloseBracket: "]",
  tagSeparator: ",",
  titlePlacement: "header",
};

/**
 * Newest day first; within a day, entries without a time in index order, then entries with a
 * time, earliest first, as the API lists them.
 */
export function sortEntries(entries: MockEntry[]): MockEntry[] {
  return [...entries].sort((left, right) => {
    if (left.date !== right.date) {
      return right.date.localeCompare(left.date);
    }
    const leftTime = left.time_of_day || null;
    const rightTime = right.time_of_day || null;
    if (leftTime !== rightTime) {
      if (leftTime === null) return -1;
      if (rightTime === null) return 1;
      return leftTime.localeCompare(rightTime);
    }
    return left.index - right.index;
  });
}

/** Moves entries to the recycle bin and closes the gaps they leave in their days, as the API does. */
export function moveToTrash(state: MockAppState, isTrashed: (entry: MockEntry) => boolean): number {
  const deletedAt = new Date().toISOString();
  const trashed = state.entries.filter(isTrashed);
  state.trash.push(...trashed.map((entry) => ({ ...entry, deletedAt })));
  // Gaps close in index order, whatever times the entries have.
  const remaining = state.entries
    .filter((entry) => !isTrashed(entry))
    .sort((left, right) => left.date.localeCompare(right.date) || left.index - right.index);
  const dayCounts = new Map<string, number>();
  state.entries = sortEntries(remaining.map((entry) => {
    const index = (dayCounts.get(entry.date) ?? 0) + 1;
    dayCounts.set(entry.date, index);
    return { ...entry, index };
  }));
  return trashed.length;
}

/** The people a set of entries mentions, as the API would hold them after saving each. */
function mentionedPeople(entries: MockEntry[]): MockPerson[] {
  const people: MockPerson[] = [];
  for (const entry of entries) addMockMentionedPeople(people, entry.content);
  return people;
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function parseImportedEntries(
  content: string,
): Array<
  Partial<MockEntry> & { date: string; content: string; tags: string[] }
> {
  try {
    const parsed = JSON.parse(content) as
      | { entries?: Array<Record<string, unknown>> }
      | Array<Record<string, unknown>>;
    const entries = Array.isArray(parsed) ? parsed : parsed.entries || [];

    return entries
      .filter(
        (
          entry,
        ): entry is Record<string, unknown> & {
          date: string;
          content: string;
        } =>
          typeof entry.date === "string" && typeof entry.content === "string",
      )
      .map((entry) => ({
        date: entry.date,
        content: entry.content,
        tags: Array.isArray(entry.tags)
          ? entry.tags.filter((tag): tag is string => typeof tag === "string")
          : [],
        visibility: entry.visibility === "public" ? "public" : "private",
        format: entry.format === "markdown" ? "markdown" : "plain",
      }));
  } catch {
    return [];
  }
}

export function buildExportBody(
  entries: MockEntry[],
  format: string | null,
): { contentType: string; body: string; extension: string } {
  if (format === "zip") {
    return { contentType: "application/zip", extension: "zip", body: "PK mock archive" };
  }

  if (format === "json") {
    return {
      contentType: "application/json",
      extension: "json",
      body: JSON.stringify({
        entries: entries.map((entry) => ({
          date: entry.date,
          index: entry.index,
          tags: entry.tags,
          content: entry.content,
          visibility: entry.visibility,
          format: entry.format || "plain",
        })),
      }),
    };
  }

  return {
    contentType: "text/plain; charset=utf-8",
    extension: "txt",
    body: entries
      .map(
        (entry) =>
          `---${entry.date}--[${entry.tags.join(",")}]\n${entry.content}\n\n--------------------------------------------------------------------------------\n`,
      )
      .join("\n"),
  };
}

export { buildStats } from "./mockApp.stats";

export function createMockAppState(
  options: SetupMockAppOptions = {},
): MockAppState {
  return {
    authenticated: options.startAuthenticated ?? false,
    user: {
      id: 1,
      username: "TestUser",
      email: "test@example.com",
      authProvider: "local",
      emailVerified: false,
      twoFactorEnabled: false,
    },
    config: {
      theme: "dark",
      language: "en",
      entriesPerPage: 10,
      autoTagMaxTags: "0",
      highContrast: false,
      readDates: true,
      // The fixtures are dated 2024, so the card would offer to pick up from them on every journal
      // page; specs about the card turn it on
      streakCard: false,
      ...options.config,
    },
    // Copied, so diaries a test creates never leak into the next test's defaults
    diaries: (options.diaries || DEFAULT_DIARIES).map((diary) => ({ ...diary })),
    entries: sortEntries(options.initialEntries || []),
    trash: (options.initialTrash || []).map((entry) => ({ ...entry })),
    revisions: options.initialRevisions || {},
    cloudStatus: options.cloudStatus || DEFAULT_CLOUD_STATUS,
    cloudSchedules: options.cloudSchedules || DEFAULT_CLOUD_SCHEDULES,
    cloudFiles: options.cloudFiles || DEFAULT_CLOUD_FILES,
    featureRequests: DEFAULT_FEATURE_REQUESTS.map((request) => ({
      ...request,
    })),
    featureRequestVotes: [],
    followedUserIds: [...(options.followedUserIds || [])],
    followerCount: options.followerCount ?? 0,
    comments: [...(options.comments || [])],
    likedEntryIds: [...(options.likedEntryIds || [])],
    likedCommentIds: [...(options.likedCommentIds || [])],
    bookVersions: [],
    bookVersionManifests: {},
    savedSearches: (options.savedSearches || []).map((saved) => ({ ...saved, filters: { ...saved.filters } })),
    lifeEras: (options.lifeEras || []).map((era) => ({ ...era })),
    onThisDayEmail: createMockOptInEmail(options.onThisDayEmail),
    monthlyRecapEmail: createMockOptInEmail(options.monthlyRecapEmail),
    people: options.people?.map((person) => ({ ...person, handles: [...person.handles] })) ?? mentionedPeople(options.initialEntries || []),
    memoir: createMockMemoirState(options.memoirProgram ?? null),
    appImport: createMockAppImportState(),
    review: createMockReviewState(),
    nextEntryId:
      [...(options.initialEntries || []), ...(options.initialTrash || [])].reduce(
        (maxId, entry) => Math.max(maxId, entry.id),
        0,
      ) + 1,
    lastLoginPayload: null,
    lastRegisterPayload: null,
    lastVerificationToken: null,
    verificationResendCount: 0,
    twoFactorSetupCount: 0,
    twoFactorChallengeToken: null,
    lastTwoFactorCode: null,
    lastPreviewPayload: null,
    lastImportPayload: null,
    lastFormatPayload: null,
    lastDeleteAllRequestUrl: null,
    lastExportRequestUrl: null,
    lastBookUploadRequestUrl: null,
    lastBookUploadRequestBody: null,
    lastBookVersionRequestUrl: null,
    lastBookPreviewRequestUrl: null,
    lastBookVersionDownloadId: null,
    lastAiSuggestionPayload: null,
    lastAiFixPayload: null,
    lastAiSummaryPayload: null,
    lastPersonalityAnalysisPayload: null,
    lastFeatureRequestPayload: null,
    lastAiInspirationPayload: null,
    lastAiDuplicatePayload: null,
    lastAiSemanticSearchPayload: null,
    lastAiChatPayload: null,
    lastAiJournalRetagPayload: null,
    personalOpenRouterKey: null,
    lastOpenRouterKeyPayload: null,
    lastBulkPayload: null,
    lastReorderPayload: null,
    taskRequests: [],
    lastCloudFilesRequestUrl: null,
    lastCloudUploadPayload: null,
    lastCloudDownloadPayload: null,
    lastCloudSchedulePayload: null,
    lastCloudSyncPayload: null,
    lastCloudDeleteScheduleProvider: null,
  };
}
