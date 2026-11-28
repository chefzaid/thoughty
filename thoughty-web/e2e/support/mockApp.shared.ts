import { createMockMemoirState, type MockMemoirProgram, type MockMemoirState } from "./mockApp.memoir";
import { createMockAppImportState, type MockAppImportState } from "./mockApp.app-import";
import { createMockReviewState, type MockReviewState } from "./mockApp.review";
import type { MockSavedSearch } from "./mockApp.routes.saved-searches";
import type { MockCalendarEvent } from "./mockApp.routes.calendar-events";
import type { MockLifeEra } from "./mockApp.routes.life-eras";
import { createMockOptInEmail, type MockOptInEmail } from "./mockApp.routes.opt-in-emails";
import type { MockDiaryWritingReminder } from "./mockApp.routes.diary-reminders";
import { addMockMentionedPeople, type MockPerson } from "./mockApp.routes.people";
import type { MockDiary } from "./mockApp.diaries";
import type { MockFeatureFlags } from "./mockApp.feature-flags";
import type { MockBookVersion } from "./mockApp.routes.books";
import type { components } from "../../src/generated/openapi";
import { DEFAULT_CLOUD_FILES, DEFAULT_CLOUD_SCHEDULES, DEFAULT_CLOUD_STATUS, DEFAULT_DIARIES, DEFAULT_FEATURE_REQUESTS, type MockFeatureRequest } from "./mockApp.defaults";
import { createMockAccountActivityState, type MockAccountActivityState } from "./mockApp.account-activity";
import { createMockContentLockState, type MockContentLockState } from "./mockApp.content-lock";
import type { MockCloudFile, MockCloudProvider, MockCloudProviderStatus, MockCloudSchedule } from "./mockApp.cloud";
import { createMockSignUpState, type MockSignUpOptions, type MockSignUpState } from "./mockApp.sign-up";
import { createMockContactState, type MockContactOptions, type MockContactState } from "./mockApp.contact";
import { createMockFollowApprovalState, type MockFollowApprovalState } from "./mockApp.routes.follow-approval";
import { createMockMessagesState, type MockConversation, type MockMessagesState } from "./mockApp.routes.messages";

export type { MockCloudFile, MockCloudProvider, MockCloudProviderStatus, MockCloudSchedule } from "./mockApp.cloud";

type AuthPayload = {
  email?: string;
  password?: string;
  username?: string;
  identifier?: string;
};

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
  /** Where it was written, as the API answers it. */
  location?: components["schemas"]["EntryLocationResponseDto"] | null;
  content: string;
  tags: string[];
  visibility: "public" | "private";
  is_favorite?: boolean;
  is_archived?: boolean;
  /** Only an app import pins an entry here (a Keep note pinned there); the mock journal has no pin button. */
  is_pinned?: boolean;
  moderationStatus?: "visible" | "hidden" | "under_review" | "removed";
  /** Who may comment; the writer's `defaultCommentPolicy` setting when unset (`mockApp.routes.comments.ts`). */
  commentPolicy?: "everyone" | "followers" | "closed";
  /** Likes by other users, before the current user's own like. */
  likeCount?: number;
  createdAt?: string;
  /** When an import brought it in (`mockApp.routes.io.ts`, `mockApp.routes.app-import.ts`); When you write leaves it out without a time. */
  importedAt?: string;
  format?: "plain" | "markdown";
  diaryId?: number | null;
  /** A time capsule: sealed until `openAt` while `openedAt` is null (`mockApp.routes.time-capsules.ts`). */
  capsule?: { openAt: string; sealedAt: string; openedAt: string | null };
  /** The day the writer asked to reread it on, `YYYY-MM-DD` (`mockApp.routes.reread-reminders.ts`). */
  rereadOn?: string | null;
  /** Locked behind the PIN on its own; its diary's `isLocked` locks it too (`mockApp.content-lock.ts`). */
  isLocked?: boolean;
  attachments?: Array<{
    id: number;
    original_filename: string;
    stored_filename: string;
    mimetype: string;
    size: number;
    poster_filename?: string | null;
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

export interface MockComment {
  id: number;
  entryId: number;
  userId: number;
  username: string;
  content: string;
  createdAt: string;
  /** Likes by other users, before the current user's own like. */
  likeCount?: number;
  /** Hidden by the entry's writer, or pinned on top of its comments. */
  hidden?: boolean;
  pinned?: boolean;
}

export interface SetupMockAppOptions {
  startAuthenticated?: boolean;
  /** Another account than the default writer (id 1, `TestUser`), for specs where two writers share a browser. */
  user?: Partial<MockAppState["user"]>;
  /** The access token the mock's sign-ins and refreshes hand out; by default one shaped as the API signs it. */
  accessToken?: string;
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
  /** Followers by approval: the reader's switch and requests, and the other writers who approve theirs. */
  followApproval?: Partial<MockFollowApprovalState>;
  writers?: Partial<MockAppState["writers"]>;
  accountActivity?: Partial<MockAccountActivityState>;
  comments?: MockComment[];
  likedEntryIds?: number[];
  likedCommentIds?: number[];
  savedEntryIds?: number[];
  /** The writer's notifications, newest first; opening them marks every one read. */
  notifications?: components["schemas"]["NotificationDto"][];
  /** The reader's conversations with other writers. */
  conversations?: MockConversation[];
  /** Feed topics followed, in lower case. */
  followedTopics?: string[];
  /** A started guided memoir (defaults filled in), or null/omitted for one not started yet. */
  memoirProgram?: Partial<MockMemoirProgram> | null;
  savedSearches?: MockSavedSearch[];
  lifeEras?: MockLifeEra[];
  /** Events of imported calendar files, each with its UID. */
  calendarEvents?: MockCalendarEvent[];
  /** The saved "On this day" email setting; off and never saved by default. */
  onThisDayEmail?: Partial<MockOptInEmail>;
  /** The saved monthly recap email setting; off and never saved by default. */
  monthlyRecapEmail?: Partial<MockOptInEmail>;
  /** The saved writing reminder email setting; off and never saved by default (its hour then reads 20). */
  writingReminderEmail?: Partial<MockOptInEmail>;
  /** The saved year in review email setting; off and never saved by default (its hour then reads 9). */
  yearReviewEmail?: Partial<MockOptInEmail>;
  /** The diaries' own writing reminder hours (Manage Diaries); none by default. */
  diaryWritingReminders?: MockDiaryWritingReminder[];
  /** The people the writer mentions; by default those the initial entries mention. */
  people?: MockPerson[];
  /** Runtime feature flags to switch off, such as `{ ai: false }`; every feature is on by default. */
  featureFlags?: MockFeatureFlags;
  signUp?: MockSignUpOptions;
  contact?: MockContactOptions;
}

export interface MockAppState {
  authenticated: boolean;
  /** The access token every sign-in and refresh answers. */
  accessToken: string;
  /** The signed-in user exactly as a new session reports it. */
  user: components["schemas"]["AuthUserDto"];
  config: {
    theme: "light" | "dark";
    language: "en" | "fr";
    autoTagMaxTags?: string | number;
    name?: string;
    bio?: string;
    email?: string;
    fontFamily?: "system" | "serif" | "modern" | "mono" | "legible";
    fontSize?: string | number;
    fontColor?: string;
    lineSpacing?: "normal" | "relaxed" | "loose";
    letterSpacing?: "normal" | "wide" | "wider";
    highContrast?: boolean | string;
    readDates?: boolean;
    streakCard?: boolean;
    /** Off unless turned on, as the API answers it for a new account. */
    quietMode?: boolean;
    /** The comfort reads offer after a very low mood; offered unless false. */
    comfortReads?: boolean;
    /** Places on entries: the composer's place field; off unless true. */
    entryLocation?: boolean;
    /** Simple memoir mode: signing in and the weekly email link open the simple screen; off unless true. */
    memoirSimpleMode?: boolean;
    /** The welcome page was done; left out (the journal opens) unless a spec or a sign-up, a new account, sets it. */
    onboardingDone?: boolean;
    defaultVisibility?: "public" | "private";
    defaultCommentPolicy?: "everyone" | "followers" | "closed";
    ttsVoiceUri?: string;
    openRouterModel?: string;
    openRouterChatModel?: string;
    openRouterPromptModel?: string;
    /** Prompt card ids drawn since their deck was last used up, comma-separated. */
    promptCardsDrawn?: string;
    /** The writer's own entry templates, as the JSON text the setting holds. */
    entryTemplates?: string;
    /** Each tag's color and category, as the JSON text the setting holds. */
    tagMetadata?: string;
  };
  diaries: MockDiary[];
  /** The PIN, its wrong tries and the unlock (`mockApp.content-lock.ts`). */
  contentLock: MockContentLockState;
  /** The account's sign-ins and security changes (`mockApp.account-activity.ts`). */
  accountActivity: MockAccountActivityState;
  featureFlags: MockFeatureFlags;
  /** Requests refused with 503 FEATURE_DISABLED, which a spec expects the web app not to send. */
  featureDisabledRequests: string[];
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
  followApproval: MockFollowApprovalState;
  writers: { muted: number[]; blocked: number[]; followers: components["schemas"]["FollowedUserDto"][] };
  comments: MockComment[];
  likedEntryIds: number[];
  likedCommentIds: number[];
  savedEntryIds: number[];
  notifications: components["schemas"]["NotificationDto"][];
  messages: MockMessagesState;
  followedTopics: string[];
  bookVersions: MockBookVersion[];
  /** What each saved version held, so the next one can count what it adds. */
  bookVersionManifests: Record<number, { entryIds: number[]; chapterTitles: string[] }>;
  savedSearches: MockSavedSearch[];
  lifeEras: MockLifeEra[];
  calendarEvents: MockCalendarEvent[];
  /** When a calendar was last imported. */
  calendarImportedAt: string;
  /** The server's clock for a calendar import, so a spec that fixes the page clock stamps the import on that day too; the real clock when unset. */
  calendarNow?: string;
  onThisDayEmail: MockOptInEmail;
  monthlyRecapEmail: MockOptInEmail;
  writingReminderEmail: MockOptInEmail;
  yearReviewEmail: MockOptInEmail;
  diaryWritingReminders: MockDiaryWritingReminder[];
  people: MockPerson[];
  memoir: MockMemoirState;
  appImport: MockAppImportState;
  review: MockReviewState;
  nextEntryId: number;
  lastLoginPayload: AuthPayload | null;
  signUp: MockSignUpState;
  contact: MockContactState;
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
  bookExportRequestUrls: URL[];
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
  /** The query and body of the last `POST /api/entries/chat`. */
  lastEntryChatRequest: { query: string; payload: unknown } | null;
  lastAiJournalRetagPayload: unknown;
  personalOpenRouterKey: string | null;
  lastOpenRouterKeyPayload: unknown;
  lastBulkPayload: unknown;
  lastReorderPayload: unknown;
  /** Every task tick sent, in order. */
  taskRequests: Array<{ entryId: number; line: number; checked: boolean; text?: string }>;
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

export { buildStats } from "./mockApp.stats";

/** An access token shaped as the API signs it: a JWT whose payload names the account (`userId`). */
export function mockAccessToken(userId: number): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part({ userId, email: "test@example.com", username: "TestUser" })}.mock-signature`;
}

export function createMockAppState(
  options: SetupMockAppOptions = {},
): MockAppState {
  return {
    authenticated: options.startAuthenticated ?? false,
    accessToken: options.accessToken ?? mockAccessToken(options.user?.id ?? 1),
    user: {
      id: 1,
      username: "TestUser",
      email: "test@example.com",
      authProvider: "local",
      emailVerified: false,
      emailMissing: false,
      twoFactorEnabled: false,
      ...options.user,
    },
    config: {
      theme: "dark",
      language: "en",
      autoTagMaxTags: "0",
      highContrast: false,
      readDates: true,
      // The fixtures are dated 2024, so the card would offer to pick up from them on every journal
      // page; specs about the card turn it on
      streakCard: false,
      quietMode: false,
      ...options.config,
    },
    // Copied, so diaries a test creates never leak into the next test's defaults
    diaries: (options.diaries || DEFAULT_DIARIES).map((diary) => ({ ...diary })),
    contentLock: createMockContentLockState(),
    accountActivity: createMockAccountActivityState(options.accountActivity),
    featureFlags: { ...options.featureFlags },
    featureDisabledRequests: [],
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
    followApproval: createMockFollowApprovalState(options.followApproval),
    writers: { muted: [...(options.writers?.muted || [])], blocked: [...(options.writers?.blocked || [])], followers: [...(options.writers?.followers || [])] },
    comments: [...(options.comments || [])],
    likedEntryIds: [...(options.likedEntryIds || [])],
    likedCommentIds: [...(options.likedCommentIds || [])],
    savedEntryIds: [...(options.savedEntryIds || [])],
    notifications: (options.notifications || []).map((notification) => ({ ...notification })),
    messages: createMockMessagesState(options.conversations),
    followedTopics: [...(options.followedTopics || [])],
    bookVersions: [],
    bookVersionManifests: {},
    savedSearches: (options.savedSearches || []).map((saved) => ({ ...saved, filters: { ...saved.filters } })),
    lifeEras: (options.lifeEras || []).map((era) => ({ ...era })),
    calendarEvents: (options.calendarEvents || []).map((event) => ({ ...event })),
    calendarImportedAt: new Date().toISOString(),
    onThisDayEmail: createMockOptInEmail(options.onThisDayEmail),
    monthlyRecapEmail: createMockOptInEmail(options.monthlyRecapEmail),
    writingReminderEmail: createMockOptInEmail({ deliveryHour: 20, ...options.writingReminderEmail }),
    yearReviewEmail: createMockOptInEmail({ deliveryHour: 9, ...options.yearReviewEmail }),
    diaryWritingReminders: (options.diaryWritingReminders || []).map((reminder) => ({ ...reminder })),
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
    signUp: createMockSignUpState(options.signUp),
    contact: createMockContactState(options.contact),
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
    bookExportRequestUrls: [],
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
    lastEntryChatRequest: null,
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
