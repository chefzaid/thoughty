import { apiErrorsTranslations, type ApiErrorTranslationKey } from "./translations.apiErrors";
import { appImportTranslations, type AppImportTranslationKey } from "./translations.appImport";
import { memoirTranslations, type MemoirTranslationKey } from "./translations.memoir";
import { reviewTranslations, type ReviewTranslationKey } from "./translations.review";
import { recycleBinTranslations, type RecycleBinTranslationKey } from "./translations.recycleBin";
import { searchTranslations, type SearchTranslationKey } from "./translations.search";
import { entryTitleTimeTranslations, type EntryTitleTimeTranslationKey } from "./translations.entryTitleTime";
import { moodTranslations, type MoodTranslationKey } from "./translations.mood";
import { taskListTranslations, type TaskListTranslationKey } from "./translations.taskList";
import { inlineImagesTranslations, type InlineImagesTranslationKey } from "./translations.inlineImages";
import { videoAttachmentsTranslations, type VideoAttachmentsTranslationKey } from "./translations.videoAttachments";
import { focusModeTranslations, type FocusModeTranslationKey } from "./translations.focusMode";
import { entryTemplatesTranslations, type EntryTemplatesTranslationKey } from "./translations.entryTemplates";
import { markdownToolbarTranslations, type MarkdownToolbarTranslationKey } from "./translations.markdownToolbar";
import { landingTranslations, type LandingTranslationKey } from "./translations.landing";
import { aiChatTranslations, type AiChatTranslationKey } from "./translations.aiChat";
import { entryActionsTranslations, type EntryActionsTranslationKey } from "./translations.entryActions";
import { socialTranslations, type SocialTranslationKey } from "./translations.social";
import { publicPagesTranslations, type PublicPagesTranslationKey } from "./translations.publicPages";
import { searchFiltersTranslations, type SearchFiltersTranslationKey } from "./translations.searchFilters";
import { savedSearchesTranslations, type SavedSearchesTranslationKey } from "./translations.savedSearches";
import { lifeErasTranslations, type LifeErasTranslationKey } from "./translations.lifeEras";
import { onThisDayEmailTranslations, type OnThisDayEmailTranslationKey } from "./translations.onThisDayEmail";
import { monthlyRecapEmailTranslations, type MonthlyRecapEmailTranslationKey } from "./translations.monthlyRecapEmail";
import { optInEmailTranslations, type OptInEmailTranslationKey } from "./translations.optInEmail";
import { timeCapsuleTranslations, type TimeCapsuleTranslationKey } from "./translations.timeCapsule";
import { peopleTranslations, type PeopleTranslationKey } from "./translations.people";
import { calendarTranslations, type CalendarTranslationKey } from "./translations.calendar";
import { tagsTranslations, type TagsTranslationKey } from "./translations.tags";
import { securityTranslations, type SecurityTranslationKey } from "./translations.security";
import { settingsTranslations, type SettingsTranslationKey } from "./translations.settings";
import { statsTranslations, type StatsTranslationKey } from "./translations.stats";
import { importExportTranslations, type ImportExportTranslationKey } from "./translations.importExport";
import { bookTranslations, type BookTranslationKey } from "./translations.book";
import { bookSourcesTranslations, type BookSourcesTranslationKey } from "./translations.bookSources";
import { bookPreviewTranslations, type BookPreviewTranslationKey } from "./translations.bookPreview";
import { authTranslations, type AuthTranslationKey } from "./translations.auth";
import { aiWritingTranslations, type AiWritingTranslationKey } from "./translations.aiWriting";
import { aiSettingsTranslations, type AiSettingsTranslationKey } from "./translations.aiSettings";
import { diariesTranslations, type DiariesTranslationKey } from "./translations.diaries";
import { writingGoalsTranslations, type WritingGoalsTranslationKey } from "./translations.writingGoals";
import { writingStreakTranslations, type WritingStreakTranslationKey } from "./translations.writingStreak";
import { shareImageTranslations, type ShareImageTranslationKey } from "./translations.shareImage";
import { subscriptionTranslations, type SubscriptionTranslationKey } from "./translations.subscription";
import { cloudSyncTranslations, type CloudSyncTranslationKey } from "./translations.cloudSync";
import { journalTranslations, type JournalTranslationKey } from "./translations.journal";
import { commonTranslations, type CommonTranslationKey } from "./translations.common";
import { fillTranslationParams } from "./translationParams";

/** Every key, merged from the feature files beside this one (translations.<feature>.ts). */
export type TranslationKey =
  | ApiErrorTranslationKey
  | AppImportTranslationKey
  | MemoirTranslationKey
  | ReviewTranslationKey
  | RecycleBinTranslationKey
  | SearchTranslationKey
  | EntryTitleTimeTranslationKey
  | MoodTranslationKey
  | TaskListTranslationKey
  | InlineImagesTranslationKey
  | VideoAttachmentsTranslationKey
  | FocusModeTranslationKey
  | EntryTemplatesTranslationKey
  | MarkdownToolbarTranslationKey
  | LandingTranslationKey
  | AiChatTranslationKey
  | EntryActionsTranslationKey
  | SocialTranslationKey
  | PublicPagesTranslationKey
  | SearchFiltersTranslationKey
  | SavedSearchesTranslationKey
  | LifeErasTranslationKey
  | OnThisDayEmailTranslationKey
  | MonthlyRecapEmailTranslationKey
  | OptInEmailTranslationKey
  | TimeCapsuleTranslationKey
  | PeopleTranslationKey
  | CalendarTranslationKey
  | TagsTranslationKey
  | SecurityTranslationKey
  | SettingsTranslationKey
  | StatsTranslationKey
  | ImportExportTranslationKey
  | BookTranslationKey
  | BookSourcesTranslationKey
  | BookPreviewTranslationKey
  | AuthTranslationKey
  | AiWritingTranslationKey
  | AiSettingsTranslationKey
  | DiariesTranslationKey
  | WritingGoalsTranslationKey
  | WritingStreakTranslationKey
  | ShareImageTranslationKey
  | SubscriptionTranslationKey
  | CloudSyncTranslationKey
  | JournalTranslationKey
  | CommonTranslationKey;

export type Language = "en" | "fr";

export type TranslationParams = Record<string, string | number>;

export type Translations = Record<Language, Record<TranslationKey, string>>;

export const translations: Translations = {
  en: {
    ...apiErrorsTranslations.en,
    ...appImportTranslations.en,
    ...memoirTranslations.en,
    ...reviewTranslations.en,
    ...recycleBinTranslations.en,
    ...searchTranslations.en,
    ...entryTitleTimeTranslations.en,
    ...moodTranslations.en,
    ...taskListTranslations.en,
    ...inlineImagesTranslations.en,
    ...videoAttachmentsTranslations.en,
    ...focusModeTranslations.en,
    ...entryTemplatesTranslations.en,
    ...markdownToolbarTranslations.en,
    ...landingTranslations.en,
    ...aiChatTranslations.en,
    ...entryActionsTranslations.en,
    ...socialTranslations.en,
    ...publicPagesTranslations.en,
    ...searchFiltersTranslations.en,
    ...savedSearchesTranslations.en,
    ...lifeErasTranslations.en,
    ...onThisDayEmailTranslations.en,
    ...monthlyRecapEmailTranslations.en,
    ...optInEmailTranslations.en,
    ...timeCapsuleTranslations.en,
    ...peopleTranslations.en,
    ...calendarTranslations.en,
    ...tagsTranslations.en,
    ...securityTranslations.en,
    ...settingsTranslations.en,
    ...statsTranslations.en,
    ...importExportTranslations.en,
    ...bookTranslations.en,
    ...bookSourcesTranslations.en,
    ...bookPreviewTranslations.en,
    ...authTranslations.en,
    ...aiWritingTranslations.en,
    ...aiSettingsTranslations.en,
    ...diariesTranslations.en,
    ...writingGoalsTranslations.en,
    ...writingStreakTranslations.en,
    ...shareImageTranslations.en,
    ...subscriptionTranslations.en,
    ...cloudSyncTranslations.en,
    ...journalTranslations.en,
    ...commonTranslations.en,
  },
  fr: {
    ...apiErrorsTranslations.fr,
    ...appImportTranslations.fr,
    ...memoirTranslations.fr,
    ...reviewTranslations.fr,
    ...recycleBinTranslations.fr,
    ...searchTranslations.fr,
    ...entryTitleTimeTranslations.fr,
    ...moodTranslations.fr,
    ...taskListTranslations.fr,
    ...inlineImagesTranslations.fr,
    ...videoAttachmentsTranslations.fr,
    ...focusModeTranslations.fr,
    ...entryTemplatesTranslations.fr,
    ...markdownToolbarTranslations.fr,
    ...landingTranslations.fr,
    ...aiChatTranslations.fr,
    ...entryActionsTranslations.fr,
    ...socialTranslations.fr,
    ...publicPagesTranslations.fr,
    ...searchFiltersTranslations.fr,
    ...savedSearchesTranslations.fr,
    ...lifeErasTranslations.fr,
    ...onThisDayEmailTranslations.fr,
    ...monthlyRecapEmailTranslations.fr,
    ...optInEmailTranslations.fr,
    ...timeCapsuleTranslations.fr,
    ...peopleTranslations.fr,
    ...calendarTranslations.fr,
    ...tagsTranslations.fr,
    ...securityTranslations.fr,
    ...settingsTranslations.fr,
    ...statsTranslations.fr,
    ...importExportTranslations.fr,
    ...bookTranslations.fr,
    ...bookSourcesTranslations.fr,
    ...bookPreviewTranslations.fr,
    ...authTranslations.fr,
    ...aiWritingTranslations.fr,
    ...aiSettingsTranslations.fr,
    ...diariesTranslations.fr,
    ...writingGoalsTranslations.fr,
    ...writingStreakTranslations.fr,
    ...shareImageTranslations.fr,
    ...subscriptionTranslations.fr,
    ...cloudSyncTranslations.fr,
    ...journalTranslations.fr,
    ...commonTranslations.fr,
  },
};

export const getTranslation = (
  lang: string,
  key: string,
  params: TranslationParams = {},
): string => {
  const language = translations[lang as Language] || translations["en"];
  const text = language[key as TranslationKey] || key;
  // A key read from data can be missing at run time (a diary without a visibility); it comes back as it was.
  return typeof text === "string" ? fillTranslationParams(text, params) : text;
};

export type TranslationFunction = (
  key: string,
  params?: TranslationParams,
) => string;
