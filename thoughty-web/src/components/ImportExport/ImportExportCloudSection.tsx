import type { Dispatch, SetStateAction } from 'react';
import type { CloudExportFormat, TranslationFunction } from '../../types';
import type { CloudFileInfo, CloudProviderType, SyncFrequency, SyncScheduleConfig } from '../../services/api/cloudSyncService';
import { CLOUD_PROVIDER_ICONS, CLOUD_PROVIDER_NAMES } from '../CloudProviderIcons';
import { CLOUD_FORMAT_OPTIONS } from './ImportExport.types';
const SCHEDULE_OPTIONS: ReadonlyArray<{ value: SyncFrequency; labelKey: string }> = [
    { value: 'every_6h', labelKey: 'cloudScheduleEvery6h' },
    { value: 'every_12h', labelKey: 'cloudScheduleEvery12h' },
    { value: 'daily', labelKey: 'cloudScheduleDaily' },
    { value: 'weekly', labelKey: 'cloudScheduleWeekly' },
];

function formatCloudDate(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return dateStr;
    }
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CloudImportSection({
    cloudLoading,
    connectedProviders,
    cloudImportProvider,
    cloudFiles,
    loadingCloudFiles,
    importingCloudFile,
    onBrowseCloudFiles,
    onImportCloudFile,
    t,
}: Readonly<{
    cloudLoading: boolean;
    connectedProviders: CloudProviderType[];
    cloudImportProvider: CloudProviderType | null;
    cloudFiles: CloudFileInfo[];
    loadingCloudFiles: boolean;
    importingCloudFile: string | null;
    onBrowseCloudFiles: (provider: CloudProviderType) => void;
    onImportCloudFile: (provider: CloudProviderType, file: CloudFileInfo) => void;
    t: TranslationFunction;
}>) {
    if (cloudLoading || connectedProviders.length === 0) {
        return null;
    }

    return (
        <div className="cloud-import-section">
            <h4>{t('cloudImportFromCloud')}</h4>
            <p className="section-description">{t('cloudSelectFileToImport')}</p>
            <div className="cloud-import-providers">
                {connectedProviders.map((provider) => {
                    const ProviderIcon = CLOUD_PROVIDER_ICONS[provider];
                    return (
                        <button
                            key={provider}
                            className={`io-btn ${cloudImportProvider === provider ? 'primary' : 'secondary'}`}
                            onClick={() => onBrowseCloudFiles(provider)}
                        >
                            {ProviderIcon && <ProviderIcon width={16} height={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.25rem' }} />}
                            {CLOUD_PROVIDER_NAMES[provider]}
                        </button>
                    );
                })}
            </div>
            {cloudImportProvider && (
                <div className="cloud-files-list">
                    {loadingCloudFiles && <div className="cloud-files-loading">{t('loading')}...</div>}
                    {!loadingCloudFiles && cloudFiles.length === 0 && <div className="cloud-files-empty">{t('cloudNoFiles')}</div>}
                    {!loadingCloudFiles && cloudFiles.map((file) => (
                        <div key={file.id} className="cloud-file-row">
                            <div className="cloud-file-info">
                                <span className="cloud-file-name">{file.name}</span>
                                <span className="cloud-file-meta">{formatFileSize(file.size)} · {formatCloudDate(file.modifiedAt)}</span>
                            </div>
                            <button
                                className="io-btn secondary"
                                onClick={() => onImportCloudFile(cloudImportProvider, file)}
                                disabled={importingCloudFile === file.id}
                            >
                                {importingCloudFile === file.id ? t('importing') : t('import')}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function CloudSyncSection({
    connectedProviders,
    schedules,
    uploading,
    syncing,
    scheduleFrequency,
    setScheduleFrequency,
    scheduleFormat,
    setScheduleFormat,
    scheduleIncludeVisibility,
    setScheduleIncludeVisibility,
    cloudExportFormat,
    setCloudExportFormat,
    cloudIncludeVisibility,
    setCloudIncludeVisibility,
    onUpload,
    onSaveSchedule,
    onRemoveSchedule,
    onSyncNow,
    t,
}: Readonly<{
    connectedProviders: CloudProviderType[];
    schedules: Record<string, SyncScheduleConfig>;
    uploading: CloudProviderType | null;
    syncing: CloudProviderType | null;
    scheduleFrequency: Record<string, SyncFrequency>;
    setScheduleFrequency: Dispatch<SetStateAction<Record<string, SyncFrequency>>>;
    scheduleFormat: Record<string, CloudExportFormat>;
    setScheduleFormat: Dispatch<SetStateAction<Record<string, CloudExportFormat>>>;
    scheduleIncludeVisibility: Record<string, boolean>;
    setScheduleIncludeVisibility: Dispatch<SetStateAction<Record<string, boolean>>>;
    cloudExportFormat: CloudExportFormat;
    setCloudExportFormat: Dispatch<SetStateAction<CloudExportFormat>>;
    cloudIncludeVisibility: boolean;
    setCloudIncludeVisibility: Dispatch<SetStateAction<boolean>>;
    onUpload: (provider: CloudProviderType) => void;
    onSaveSchedule: (provider: CloudProviderType) => void;
    onRemoveSchedule: (provider: CloudProviderType) => void;
    onSyncNow: (provider: CloudProviderType) => void;
    t: TranslationFunction;
}>) {
    if (connectedProviders.length === 0) {
        return null;
    }

    return (
        <section className="io-section cloud-sync-section">
            <h3>{t('cloudSync')}</h3>
            <p className="section-description">{t('cloudSyncDescription')}</p>
            <div className="cloud-sync-grid">
                {connectedProviders.map((provider) => {
                    const schedule = schedules[provider];
                    const ProviderIcon = CLOUD_PROVIDER_ICONS[provider];

                    return (
                        <div key={provider} className="cloud-sync-card">
                            <div className="cloud-sync-card-header">
                                <span className="cloud-sync-card-icon">{ProviderIcon && <ProviderIcon width={20} height={20} />}</span>
                                <span className="cloud-sync-card-name">{CLOUD_PROVIDER_NAMES[provider]}</span>
                                {schedule?.enabled && <span className="cloud-sync-active-dot" />}
                            </div>

                            <div className="cloud-sync-row">
                                <div className="cloud-sync-upload-options">
                                    <div className="cloud-upload-row">
                                        <label>{t('exportFormat')}</label>
                                        <select value={cloudExportFormat} onChange={(event) => setCloudExportFormat(event.target.value as CloudExportFormat)}>
                                            {CLOUD_FORMAT_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <label className="checkbox-label">
                                        <input type="checkbox" checked={cloudIncludeVisibility} onChange={() => setCloudIncludeVisibility((current) => !current)} />
                                        {t('includeVisibility')}
                                    </label>
                                </div>
                                <button className="io-btn primary" onClick={() => onUpload(provider)} disabled={uploading === provider}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                    {uploading === provider ? t('cloudUploading') : t('cloudUpload')}
                                </button>
                            </div>

                            <div className="cloud-sync-schedule">
                                <h4>{t('cloudSchedule')}</h4>
                                <p className="section-description">{t('cloudScheduleDescription')}</p>
                                {schedule?.enabled && <div className="cloud-schedule-status active"><span className="cloud-schedule-status-dot" />{t('cloudScheduleEnabled')}</div>}
                                {schedule?.lastSyncAt && <div className="cloud-schedule-meta">{t('cloudLastSync', { date: formatCloudDate(schedule.lastSyncAt) })}</div>}
                                {schedule?.nextSyncAt && schedule?.enabled && <div className="cloud-schedule-meta">{t('cloudNextSync', { date: formatCloudDate(schedule.nextSyncAt) })}</div>}

                                <div className="cloud-upload-row">
                                    <label>{t('cloudScheduleFrequency')}</label>
                                    <select value={scheduleFrequency[provider]} onChange={(event) => setScheduleFrequency((current) => ({ ...current, [provider]: event.target.value as SyncFrequency }))}>
                                        {SCHEDULE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="cloud-upload-row">
                                    <label>{t('exportFormat')}</label>
                                    <select value={scheduleFormat[provider]} onChange={(event) => setScheduleFormat((current) => ({ ...current, [provider]: event.target.value as CloudExportFormat }))}>
                                        {CLOUD_FORMAT_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
                                        ))}
                                    </select>
                                </div>

                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={scheduleIncludeVisibility[provider]}
                                        onChange={() => setScheduleIncludeVisibility((current) => ({ ...current, [provider]: !current[provider] }))}
                                    />
                                    {t('includeVisibility')}
                                </label>

                                <div className="cloud-schedule-actions">
                                    <button className="io-btn primary" onClick={() => onSaveSchedule(provider)}>{t('cloudScheduleEnable')}</button>
                                    {schedule?.enabled && <button className="io-btn danger" onClick={() => onRemoveSchedule(provider)}>{t('cloudScheduleDisable')}</button>}
                                    <button className="io-btn secondary" onClick={() => onSyncNow(provider)} disabled={syncing === provider}>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        {syncing === provider ? t('cloudSyncing') : t('cloudSyncNow')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}