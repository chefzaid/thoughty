import type { CloudExportFormat, ImportExportFormat, ImportExportSection, TranslationFunction } from '../../types';
import type { CloudProviderType } from '../../services/api/cloudSyncService';

export const CLOUD_PROVIDERS = ['google_drive', 'onedrive', 'dropbox'] as const satisfies readonly CloudProviderType[];
export const EXPORT_FORMAT_OPTIONS: ReadonlyArray<{ value: ImportExportFormat; labelKey: string }> = [
    { value: 'txt', labelKey: 'formatTxt' },
    { value: 'json', labelKey: 'formatJson' },
    { value: 'md', labelKey: 'formatMd' },
    { value: 'csv', labelKey: 'formatCsv' },
    { value: 'pdf', labelKey: 'bookFormatPdf' },
    { value: 'epub', labelKey: 'bookFormatEpub' },
    { value: 'html', labelKey: 'bookFormatHtml' },
];

// Cloud sync uploads support the text-based formats only
export const CLOUD_FORMAT_OPTIONS: ReadonlyArray<{ value: CloudExportFormat; labelKey: string }> = [
    { value: 'txt', labelKey: 'formatTxt' },
    { value: 'json', labelKey: 'formatJson' },
    { value: 'md', labelKey: 'formatMd' },
];

export type BookFormat = 'pdf' | 'epub' | 'html' | 'md';
export type BookChapterOrder = 'alpha' | 'entries' | 'chrono';
export type BookTagScope = 'all' | 'first';
export type BookWeavingMode = 'strict' | 'creative';

export const BOOK_FORMAT_OPTIONS: ReadonlyArray<{ value: BookFormat; labelKey: string }> = [
    { value: 'pdf', labelKey: 'bookFormatPdf' },
    { value: 'epub', labelKey: 'bookFormatEpub' },
    { value: 'html', labelKey: 'bookFormatHtml' },
    { value: 'md', labelKey: 'formatMd' },
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

export interface BookOptions {
    title: string;
    author: string;
    format: BookFormat;
    chapterOrder: BookChapterOrder;
    tagScope: BookTagScope;
    weavingMode: BookWeavingMode;
    includeUntagged: boolean;
    includeDates: boolean;
    includeToc: boolean;
    narrative: boolean;
}

export const DEFAULT_BOOK_OPTIONS: BookOptions = {
    title: '',
    author: '',
    format: 'pdf',
    chapterOrder: 'alpha',
    tagScope: 'all',
    weavingMode: 'strict',
    includeUntagged: true,
    includeDates: true,
    includeToc: true,
    narrative: true,
};

export interface BookChapterPreview {
    title: string;
    entryCount: number;
    firstDate: string;
    lastDate: string;
}

export interface BookPreviewData {
    title: string;
    author?: string;
    chapterCount: number;
    entryCount: number;
    chapters: BookChapterPreview[];
}

export function createProviderRecord<T>(value: T): Record<CloudProviderType, T> {
    return Object.fromEntries(CLOUD_PROVIDERS.map((provider) => [provider, value])) as Record<CloudProviderType, T>;
}

export interface FormatConfig {
    entrySeparator: string;
    sameDaySeparator: string;
    datePrefix: string;
    dateSuffix: string;
    dateFormat: string;
    tagOpenBracket: string;
    tagCloseBracket: string;
    tagSeparator: string;
}

export interface PreviewData {
    totalCount: number;
    duplicateCount: number;
}

export interface MessageState {
    type: 'success' | 'error';
    text: string;
}

export interface ImportExportRouteState {
    section: ImportExportSection;
    exportFormat: ImportExportFormat;
    includeVisibility: boolean;
}

export interface ImportExportProps {
    readonly theme?: 'light' | 'dark';
    readonly t: TranslationFunction;
    readonly diaryId?: number | null;
    readonly diaryName?: string;
    readonly initialSection?: ImportExportSection;
    readonly initialExportFormat?: ImportExportFormat;
    readonly initialIncludeVisibility?: boolean;
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
};
