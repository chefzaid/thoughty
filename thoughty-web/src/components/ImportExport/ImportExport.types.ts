import type { components } from '../../generated/openapi';
import type { CloudExportFormat, ImportExportFormat, ImportExportSection, TranslationFunction } from '../../types';
import type { CloudProviderType } from '../../services/api/cloudSyncService';
import type { Language } from '../../utils/translations';

export const CLOUD_PROVIDERS = ['google_drive', 'onedrive', 'dropbox'] as const satisfies readonly CloudProviderType[];
export const EXPORT_FORMAT_OPTIONS: ReadonlyArray<{ value: ImportExportFormat; labelKey: string }> = [
    { value: 'txt', labelKey: 'formatTxt' },
    { value: 'json', labelKey: 'formatJson' },
    { value: 'md', labelKey: 'formatMd' },
    { value: 'csv', labelKey: 'formatCsv' },
    { value: 'pdf', labelKey: 'bookFormatPdf' },
    { value: 'epub', labelKey: 'bookFormatEpub' },
    { value: 'html', labelKey: 'bookFormatHtml' },
    { value: 'zip', labelKey: 'formatMarkdownFolder' },
];

// Cloud sync uploads support the text-based formats only
export const CLOUD_FORMAT_OPTIONS: ReadonlyArray<{ value: CloudExportFormat; labelKey: string }> = [
    { value: 'txt', labelKey: 'formatTxt' },
    { value: 'json', labelKey: 'formatJson' },
    { value: 'md', labelKey: 'formatMd' },
];

export type BookFormat = 'pdf' | 'epub' | 'html' | 'md';
export type BookChapterMode = 'tags' | 'year' | 'month' | 'single' | 'eras';
/** Where the book's entries come from: the journal, a saved search, or entries picked in the journal. */
export type BookSource = 'journal' | 'savedSearch' | 'entries';
export type BookChapterOrder = 'alpha' | 'entries' | 'chrono';
export type BookTagScope = 'all' | 'first';
export type BookWeavingMode = 'strict' | 'creative';
export type BookCoverTheme = 'classic' | 'ocean' | 'forest' | 'rose';

export const BOOK_FORMAT_OPTIONS: ReadonlyArray<{ value: BookFormat; labelKey: string }> = [
    { value: 'pdf', labelKey: 'bookFormatPdf' },
    { value: 'epub', labelKey: 'bookFormatEpub' },
    { value: 'html', labelKey: 'bookFormatHtml' },
    { value: 'md', labelKey: 'formatMd' },
];

export const BOOK_CHAPTER_MODE_OPTIONS: ReadonlyArray<{ value: BookChapterMode; labelKey: string }> = [
    { value: 'tags', labelKey: 'bookChapterModeTags' },
    { value: 'year', labelKey: 'bookChapterModeYear' },
    { value: 'month', labelKey: 'bookChapterModeMonth' },
    { value: 'single', labelKey: 'bookChapterModeSingle' },
    { value: 'eras', labelKey: 'bookChapterModeEras' },
];

export const BOOK_CHAPTER_ORDER_OPTIONS: ReadonlyArray<{ value: BookChapterOrder; labelKey: string }> = [
    { value: 'alpha', labelKey: 'chapterOrderAlpha' },
    { value: 'entries', labelKey: 'chapterOrderEntries' },
    { value: 'chrono', labelKey: 'chapterOrderChrono' },
];

export const BOOK_TAG_SCOPE_OPTIONS: ReadonlyArray<{ value: BookTagScope; labelKey: string }> = [
    { value: 'all', labelKey: 'tagScopeAll' },
    { value: 'first', labelKey: 'tagScopeFirst' },
];

export const BOOK_WEAVING_MODE_OPTIONS: ReadonlyArray<{ value: BookWeavingMode; labelKey: string }> = [
    { value: 'strict', labelKey: 'bookWeavingStrict' },
    { value: 'creative', labelKey: 'bookWeavingCreative' },
];

export const BOOK_SOURCE_OPTIONS: ReadonlyArray<{ value: BookSource; labelKey: string }> = [
    { value: 'journal', labelKey: 'bookSourceJournal' },
    { value: 'savedSearch', labelKey: 'bookSourceSavedSearch' },
    { value: 'entries', labelKey: 'bookSourceEntries' },
];

export interface BookOptions {
    source: BookSource;
    /** The saved search a saved-search book is built from. */
    savedSearchId: number | null;
    /** The entries of a hand-picked book, in the order they were picked. */
    entryIds: number[];
    title: string;
    author: string;
    format: BookFormat;
    chapterMode: BookChapterMode;
    chapterOrder: BookChapterOrder;
    tagScope: BookTagScope;
    weavingMode: BookWeavingMode;
    includeUntagged: boolean;
    includeDates: boolean;
    includeToc: boolean;
    narrative: boolean;
    chapterFraming: boolean;
    embedImages: boolean;
    coverTheme: BookCoverTheme;
    coverImage: File | null;
}

export const DEFAULT_BOOK_OPTIONS: BookOptions = {
    source: 'journal',
    savedSearchId: null,
    entryIds: [],
    title: '',
    author: '',
    format: 'pdf',
    chapterMode: 'tags',
    chapterOrder: 'alpha',
    tagScope: 'all',
    weavingMode: 'strict',
    includeUntagged: true,
    includeDates: true,
    includeToc: true,
    narrative: true,
    chapterFraming: false,
    embedImages: false,
    coverTheme: 'classic',
    coverImage: null,
};

// Book responses, derived from the API contract so a renamed field fails the type check
export type BookChapterPreview = components['schemas']['BookChapterPreviewDto'];
export type BookPreviewData = components['schemas']['BookPreviewResponseDto'];
export type BookVersionData = components['schemas']['BookVersionResponseDto'];
export type BookPickedEntries = components['schemas']['BookPickedEntriesResponseDto'];
export type BookPickedEntry = components['schemas']['BookPickedEntryDto'];

export function createProviderRecord<T>(value: T): Record<CloudProviderType, T> {
    return Object.fromEntries(CLOUD_PROVIDERS.map((provider) => [provider, value])) as Record<CloudProviderType, T>;
}

/** The TXT layout, as `GET /api/io/format` answers it; `titlePlacement` says where entry titles go. */
export type FormatConfig = components['schemas']['FormatConfigResponseDto'];

export type TitlePlacement = FormatConfig['titlePlacement'];

export interface PreviewData {
    totalCount: number;
    duplicateCount: number;
}

export interface MessageState {
    type: 'success' | 'error';
    text: string;
    /** How long the message stays on screen before `AutoDismiss` hides it; without one it stays. */
    durationMs?: number;
}

export interface ImportExportRouteState {
    section: ImportExportSection;
    exportFormat: ImportExportFormat;
    includeVisibility: boolean;
}

export interface ImportExportProps {
    readonly theme?: 'light' | 'dark';
    readonly t: TranslationFunction;
    readonly language?: Language;
    readonly diaryId?: number | null;
    readonly diaryName?: string;
    /** Called after an app import created diaries, so the diary list can be refreshed. */
    readonly onDiariesChanged?: () => void;
    readonly initialSection?: ImportExportSection;
    readonly initialExportFormat?: ImportExportFormat;
    readonly initialIncludeVisibility?: boolean;
    /** Entries picked in the journal, which open the book converter as a hand-picked book. */
    readonly initialBookEntryIds?: readonly number[];
    readonly onRouteStateChange?: (state: ImportExportRouteState) => void;
}

export const DEFAULT_FORMAT_CONFIG: FormatConfig = {
    entrySeparator: '--------------------------------------------------------------------------------',
    sameDaySeparator: '********************************************************************************',
    datePrefix: '---',
    dateSuffix: '--',
    dateFormat: 'YYYY-MM-DD',
    tagOpenBracket: '[',
    tagCloseBracket: ']',
    tagSeparator: ',',
    titlePlacement: 'header',
};
