import type { ImportExportFormat, ImportExportSection, TranslationFunction } from '../../types';
import type { CloudProviderType } from '../../services/api/cloudSyncService';

export const CLOUD_PROVIDERS = ['google_drive', 'onedrive', 'dropbox'] as const satisfies readonly CloudProviderType[];
export const EXPORT_FORMAT_OPTIONS: ReadonlyArray<{ value: ImportExportFormat; labelKey: string }> = [
    { value: 'txt', labelKey: 'formatTxt' },
    { value: 'json', labelKey: 'formatJson' },
    { value: 'md', labelKey: 'formatMd' },
];

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