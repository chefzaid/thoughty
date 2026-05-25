import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import './ImportExport.css';
import { useAuth } from '../../contexts/AuthContext';
import { useApiServices } from '../../hooks/useAppState';
import type { ImportExportFormat, ImportExportSection } from '../../types';
import type { CloudProviderType, CloudFileInfo, SyncScheduleConfig, SyncFrequency } from '../../services/api/cloudSyncService';
import { CLOUD_PROVIDER_ICONS, CLOUD_PROVIDER_NAMES } from '../CloudProviderIcons';

interface FormatConfig {
    entrySeparator: string;
    sameDaySeparator: string;
    datePrefix: string;
    dateSuffix: string;
    dateFormat: string;
    tagOpenBracket: string;
    tagCloseBracket: string;
    tagSeparator: string;
}

interface PreviewData {
    totalCount: number;
    duplicateCount: number;
}

interface MessageState {
    type: 'success' | 'error';
    text: string;
}

interface ImportExportProps {
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
    readonly diaryId?: number | null;
    readonly diaryName?: string;
    readonly initialSection?: ImportExportSection;
    readonly initialExportFormat?: ImportExportFormat;
    readonly initialIncludeVisibility?: boolean;
    readonly onRouteStateChange?: (state: {
        section: ImportExportSection;
        exportFormat: ImportExportFormat;
        includeVisibility: boolean;
    }) => void;
}

function ImportExport({
    theme,
    t,
    diaryId,
    diaryName,
    initialSection = 'export',
    initialExportFormat = 'txt',
    initialIncludeVisibility = false,
    onRouteStateChange,
}: ImportExportProps) {
    const { authFetch } = useAuth();
    const { cloudSyncService } = useApiServices();
    const [formatConfig, setFormatConfig] = useState<FormatConfig>({
        entrySeparator: '--------------------------------------------------------------------------------',
        sameDaySeparator: '********************************************************************************',
        datePrefix: '---',
        dateSuffix: '--',
        dateFormat: 'YYYY-MM-DD',
        tagOpenBracket: '[',
        tagCloseBracket: ']',
        tagSeparator: ','
    });
    const [loading, setLoading] = useState<boolean>(true);
    const [importing, setImporting] = useState<boolean>(false);
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [fileContent, setFileContent] = useState<string>('');
    const [message, setMessage] = useState<MessageState | null>(null);
    const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
    const [includeVisibility, setIncludeVisibility] = useState<boolean>(initialIncludeVisibility);
    const [exportFormat, setExportFormat] = useState<ImportExportFormat>(initialExportFormat);
    const [activeSection, setActiveSection] = useState<ImportExportSection>(initialSection);
    const [confirmDeleteAll, setConfirmDeleteAll] = useState<boolean>(false);
    const [deleting, setDeleting] = useState<boolean>(false);

    // Cloud sync state
    const [cloudStatus, setCloudStatus] = useState<Record<string, { connected: boolean; connectedAt?: string }>>({});
    const [cloudLoading, setCloudLoading] = useState(true);
    const [uploading, setUploading] = useState<CloudProviderType | null>(null);
    const [syncing, setSyncing] = useState<CloudProviderType | null>(null);
    const [schedules, setSchedules] = useState<Record<string, SyncScheduleConfig>>({});
    const [scheduleFrequency, setScheduleFrequency] = useState<Record<string, SyncFrequency>>({
        google_drive: 'daily', onedrive: 'daily', dropbox: 'daily',
    });
    const [scheduleFormat, setScheduleFormat] = useState<Record<string, ImportExportFormat>>({
        google_drive: 'txt', onedrive: 'txt', dropbox: 'txt',
    });
    const [scheduleIncludeVisibility, setScheduleIncludeVisibility] = useState<Record<string, boolean>>({
        google_drive: false, onedrive: false, dropbox: false,
    });
    const [cloudExportFormat, setCloudExportFormat] = useState<ImportExportFormat>('txt');
    const [cloudIncludeVisibility, setCloudIncludeVisibility] = useState(false);
    // Cloud import state
    const [cloudImportProvider, setCloudImportProvider] = useState<CloudProviderType | null>(null);
    const [cloudFiles, setCloudFiles] = useState<CloudFileInfo[]>([]);
    const [loadingCloudFiles, setLoadingCloudFiles] = useState(false);
    const [importingCloudFile, setImportingCloudFile] = useState<string | null>(null);
    const exportSectionRef = useRef<HTMLElement | null>(null);
    const importSectionRef = useRef<HTMLElement | null>(null);

    const isLight = theme === 'light';

    const emitRouteState = useCallback((nextState: Partial<{
        section: ImportExportSection;
        exportFormat: ImportExportFormat;
        includeVisibility: boolean;
    }> = {}): void => {
        onRouteStateChange?.({
            section: nextState.section ?? activeSection,
            exportFormat: nextState.exportFormat ?? exportFormat,
            includeVisibility: nextState.includeVisibility ?? includeVisibility,
        });
    }, [activeSection, exportFormat, includeVisibility, onRouteStateChange]);

    useEffect(() => {
        setActiveSection(initialSection);
    }, [initialSection]);

    useEffect(() => {
        setExportFormat(initialExportFormat);
    }, [initialExportFormat]);

    useEffect(() => {
        setIncludeVisibility(initialIncludeVisibility);
    }, [initialIncludeVisibility]);

    useEffect(() => {
        const targetSection = activeSection === 'import' ? importSectionRef.current : exportSectionRef.current;
        if (targetSection && typeof targetSection.scrollIntoView === 'function') {
            targetSection.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
    }, [activeSection]);

    // Fetch current format settings on mount
    const fetchFormatSettings = useCallback(async (): Promise<void> => {
        try {
            const response = await authFetch('/api/io/format');
            if (response.ok) {
                const data = await response.json();
                setFormatConfig(data);
            }
        } catch (error) {
            console.error('Failed to fetch format settings:', error);
        } finally {
            setLoading(false);
        }
    }, [authFetch]);

    useEffect(() => {
        void fetchFormatSettings();
    }, [fetchFormatSettings]);

    const saveFormatSettings = async (): Promise<void> => {
        try {
            const response = await authFetch('/api/io/format', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formatConfig)
            });
            if (response.ok) {
                setMessage({ type: 'success', text: t('formatSaved') });
                setTimeout(() => setMessage(null), 3000);
            }
        } catch (error) {
            console.error('Failed to save format settings:', error);
            setMessage({ type: 'error', text: t('formatSaveError') });
        }
    };

    const handleExport = async (): Promise<void> => {
        try {
            const params = new URLSearchParams();
            if (diaryId) params.append('diaryId', diaryId.toString());
            if (includeVisibility) params.append('includeVisibility', 'true');
            if (exportFormat !== 'txt') params.append('format', exportFormat);
            const response = await authFetch(`/api/io/export?${params}`);
            if (response.ok) {
                const blob = await response.blob();
                const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replaceAll('"', '')
                    || `thoughty_export_${new Date().toISOString().split('T')[0]}.txt`;

                const url = globalThis.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                globalThis.URL.revokeObjectURL(url);
                a.remove();

                setMessage({ type: 'success', text: t('exportSuccess') });
                setTimeout(() => setMessage(null), 3000);
            }
        } catch (error) {
            console.error('Export failed:', error);
            setMessage({ type: 'error', text: t('exportError') });
        }
    };

    const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const content = await file.text();
            setFileContent(content);

            // Get preview
            const response = await authFetch('/api/io/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, diaryId })
            });
            if (response.ok) {
                const data = await response.json();
                setPreview(data);
            }
        } catch (error) {
            console.error('Preview failed:', error);
            setMessage({ type: 'error', text: t('previewError') });
        }
    };

    const handleImport = async (): Promise<void> => {
        if (!fileContent) return;

        setImporting(true);
        try {
            const response = await authFetch('/api/io/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: fileContent, skipDuplicates, diaryId })
            });
            if (response.ok) {
                const data = await response.json();
                setMessage({
                    type: 'success',
                    text: t('importSuccess', {
                        imported: data.importedCount,
                        skipped: data.skippedCount
                    })
                });
                setPreview(null);
                setFileContent('');
            }
        } catch (error) {
            console.error('Import failed:', error);
            setMessage({ type: 'error', text: t('importError') });
        } finally {
            setImporting(false);
        }
    };

    const handleInputChange = (key: keyof FormatConfig, value: string): void => {
        setFormatConfig(prev => ({ ...prev, [key]: value }));
    };

    // Cloud sync functions
    const PROVIDER_CONFIG: Record<CloudProviderType, { name: string }> = {
        google_drive: { name: CLOUD_PROVIDER_NAMES.google_drive },
        onedrive: { name: CLOUD_PROVIDER_NAMES.onedrive },
        dropbox: { name: CLOUD_PROVIDER_NAMES.dropbox },
    };

    const fetchCloudStatus = useCallback(async () => {
        const data = await cloudSyncService.getStatus();
        if (data) setCloudStatus(data as unknown as Record<string, { connected: boolean; connectedAt?: string }>);
        setCloudLoading(false);
    }, [cloudSyncService]);

    const fetchSchedules = useCallback(async () => {
        const data = await cloudSyncService.getSchedules();
        if (data) {
            setSchedules(data);
            for (const [provider, config] of Object.entries(data)) {
                if (config.frequency) {
                    setScheduleFrequency(prev => ({ ...prev, [provider]: config.frequency as SyncFrequency }));
                }
                if (config.format) {
                    setScheduleFormat(prev => ({ ...prev, [provider]: config.format as ImportExportFormat }));
                }
                if (config.includeVisibility !== undefined) {
                    setScheduleIncludeVisibility(prev => ({ ...prev, [provider]: config.includeVisibility! }));
                }
            }
        }
    }, [cloudSyncService]);

    useEffect(() => {
        fetchCloudStatus();
        fetchSchedules();
    }, [fetchCloudStatus, fetchSchedules]);

    const handleCloudUpload = async (provider: CloudProviderType) => {
        setUploading(provider);
        const result = await cloudSyncService.uploadExport(provider, {
            diaryId: diaryId ?? undefined,
            format: cloudExportFormat,
            includeVisibility: cloudIncludeVisibility,
        });
        if (result) {
            setMessage({ type: 'success', text: t('cloudUploadSuccess', { name: result.name }) });
        } else {
            setMessage({ type: 'error', text: t('cloudUploadError') });
        }
        setUploading(null);
        setTimeout(() => setMessage(null), 4000);
    };

    const handleSaveSchedule = async (provider: CloudProviderType) => {
        const success = await cloudSyncService.setSchedule(provider, {
            frequency: scheduleFrequency[provider] || 'daily',
            format: scheduleFormat[provider],
            diaryId: diaryId ?? undefined,
            includeVisibility: scheduleIncludeVisibility[provider],
        });
        if (success) {
            setMessage({ type: 'success', text: t('cloudScheduleSaved') });
            await fetchSchedules();
        } else {
            setMessage({ type: 'error', text: t('cloudScheduleSaveError') });
        }
        setTimeout(() => setMessage(null), 4000);
    };

    const handleRemoveSchedule = async (provider: CloudProviderType) => {
        const success = await cloudSyncService.deleteSchedule(provider);
        if (success) {
            setMessage({ type: 'success', text: t('cloudScheduleRemoved') });
            await fetchSchedules();
        } else {
            setMessage({ type: 'error', text: t('cloudScheduleRemoveError') });
        }
        setTimeout(() => setMessage(null), 4000);
    };

    const handleSyncNow = async (provider: CloudProviderType) => {
        setSyncing(provider);
        const result = await cloudSyncService.triggerSync(provider);
        if (result) {
            if (result.synced) {
                setMessage({ type: 'success', text: t('cloudSyncSuccess', { name: result.file?.name || '' }) });
            } else {
                setMessage({ type: 'success', text: t('cloudSyncNoChanges') });
            }
            await fetchSchedules();
        } else {
            setMessage({ type: 'error', text: t('cloudSyncError') });
        }
        setSyncing(null);
        setTimeout(() => setMessage(null), 4000);
    };

    const handleBrowseCloudFiles = async (provider: CloudProviderType) => {
        if (cloudImportProvider === provider) {
            setCloudImportProvider(null);
            setCloudFiles([]);
            return;
        }
        setCloudImportProvider(provider);
        setLoadingCloudFiles(true);
        const data = await cloudSyncService.listFiles(provider);
        setCloudFiles(data);
        setLoadingCloudFiles(false);
    };

    const handleCloudFileImport = async (provider: CloudProviderType, file: CloudFileInfo) => {
        setImportingCloudFile(file.id);
        const content = await cloudSyncService.downloadFile(provider, file.id);
        if (content) {
            // Preview the cloud file content like a local file
            setFileContent(content);
            try {
                const response = await authFetch('/api/io/preview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content, diaryId })
                });
                if (response.ok) {
                    const data = await response.json();
                    setPreview(data);
                    setMessage({ type: 'success', text: t('cloudDownloadSuccess', { name: file.name }) });
                }
            } catch (error) {
                console.error('Cloud file preview failed:', error);
                setMessage({ type: 'error', text: t('previewError') });
            }
        } else {
            setMessage({ type: 'error', text: t('cloudDownloadError') });
        }
        setImportingCloudFile(null);
        setTimeout(() => setMessage(null), 4000);
    };

    const formatCloudDate = (dateStr: string): string => {
        try {
            return new Date(dateStr).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
        } catch { return dateStr; }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const connectedProviders = (Object.keys(PROVIDER_CONFIG) as CloudProviderType[])
        .filter(p => cloudStatus[p]?.connected);

    const handleDeleteAll = async (): Promise<void> => {
        if (!confirmDeleteAll) {
            setConfirmDeleteAll(true);
            return;
        }

        setDeleting(true);
        try {
            const params = new URLSearchParams();
            if (diaryId) params.append('diaryId', diaryId.toString());
            const response = await authFetch(`/api/entries/all?${params}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                setMessage({ type: 'success', text: t('deleteAllSuccess') });
                setConfirmDeleteAll(false);
            } else {
                setMessage({ type: 'error', text: t('deleteAllError') });
            }
        } catch (error) {
            console.error('Delete all failed:', error);
            setMessage({ type: 'error', text: t('deleteAllError') });
        } finally {
            setDeleting(false);
        }
    };

    let deleteAllLabel = t('deleteAllEntries');
    if (confirmDeleteAll) {
        deleteAllLabel = t('confirmDeleteAll');
    }
    if (deleting) {
        deleteAllLabel = t('deleting');
    }

    if (loading) {
        return <div className={`import-export ${isLight ? 'light' : 'dark'}`}>{t('loading')}...</div>;
    }

    return (
        <div className={`import-export ${isLight ? 'light' : 'dark'}`}>
            <h2>{t('importExport')}</h2>

            <nav className="io-route-actions" aria-label={t('importExport')}>
                <button
                    type="button"
                    className={`io-btn ${activeSection === 'export' ? 'primary' : 'secondary'}`}
                    onClick={() => {
                        setActiveSection('export');
                        emitRouteState({ section: 'export' });
                    }}
                >
                    {t('export')}
                </button>
                <button
                    type="button"
                    className={`io-btn ${activeSection === 'import' ? 'primary' : 'secondary'}`}
                    onClick={() => {
                        setActiveSection('import');
                        emitRouteState({ section: 'import' });
                    }}
                >
                    {t('import')}
                </button>
                <button
                    type="button"
                    className="io-btn secondary"
                    onClick={() => {
                        setActiveSection('export');
                        setExportFormat('json');
                        emitRouteState({ section: 'export', exportFormat: 'json' });
                    }}
                >
                    {t('formatJson')}
                </button>
            </nav>

            {message && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="io-grid">
                {/* Export Section */}
                <section
                    ref={exportSectionRef}
                    className={`io-section ${activeSection === 'export' ? 'is-route-target' : ''}`}
                    id="export-section"
                >
                    <h3>{t('export')}</h3>
                    <p className="section-description">{t('exportDescription', { diaryName: diaryName || '' })}</p>
                    <div className="export-controls">
                        <div className="export-option-row export-option-row--split">
                            <div className="export-option-group export-option-group--format">
                                <label>{t('exportFormat')}</label>
                                <select
                                    value={exportFormat}
                                    onChange={(e) => {
                                        const nextFormat = e.target.value as ImportExportFormat;
                                        setExportFormat(nextFormat);
                                        emitRouteState({ exportFormat: nextFormat });
                                    }}
                                    className="format-select"
                                >
                                    <option value="txt">{t('formatTxt')}</option>
                                    <option value="json">{t('formatJson')}</option>
                                    <option value="md">{t('formatMd')}</option>
                                </select>
                            </div>
                            <div className="export-option-group export-option-group--visibility">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={includeVisibility}
                                        onChange={() => {
                                            const nextIncludeVisibility = !includeVisibility;
                                            setIncludeVisibility(nextIncludeVisibility);
                                            emitRouteState({ includeVisibility: nextIncludeVisibility });
                                        }}
                                    />
                                    {t('includeVisibilityShort')}
                                </label>
                            </div>
                            <button className="io-btn primary" onClick={handleExport}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                {t('downloadExport')}
                            </button>
                        </div>
                    </div>
                </section>

                {/* Import Section */}
                <section
                    ref={importSectionRef}
                    className={`io-section ${activeSection === 'import' ? 'is-route-target' : ''}`}
                    id="import-section"
                >
                    <h3>{t('import')}</h3>
                    <p className="section-description">{t('importDescription', { diaryName: diaryName || '' })}</p>

                    <div className="file-upload">
                        <input
                            type="file"
                            id="file-input"
                            accept=".txt,.json,.md"
                            onChange={handleFileSelect}
                        />
                        <label htmlFor="file-input" className="file-label">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            {t('chooseFile')}
                        </label>
                    </div>

                    {preview && (
                        <div className="preview-box">
                            <h4>{t('previewSummary')}</h4>
                            <div className="preview-stats">
                                <div className="stat">
                                    <span className="stat-value">{preview.totalCount}</span>
                                    <span className="stat-label">{t('entriesFound')}</span>
                                </div>
                                <div className={`stat ${preview.duplicateCount > 0 ? 'warning' : ''}`}>
                                    <span className="stat-value">{preview.duplicateCount}</span>
                                    <span className="stat-label">{t('duplicatesFound')}</span>
                                </div>
                            </div>

                            {preview.duplicateCount > 0 && (
                                <div className="duplicate-option">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={skipDuplicates}
                                            onChange={(e) => setSkipDuplicates(e.target.checked)}
                                        />
                                        {t('skipDuplicates')}
                                    </label>
                                </div>
                            )}

                            <button
                                className="io-btn primary"
                                onClick={handleImport}
                                disabled={importing}
                            >
                                {importing ? t('importing') : t('confirmImport')}
                            </button>
                        </div>
                    )}

                    {/* Cloud file import */}
                    {!cloudLoading && connectedProviders.length > 0 && (
                        <div className="cloud-import-section">
                            <h4>{t('cloudImportFromCloud')}</h4>
                            <p className="section-description">{t('cloudSelectFileToImport')}</p>
                            <div className="cloud-import-providers">
                                {connectedProviders.map(provider => {
                                    const ProvIcon = CLOUD_PROVIDER_ICONS[provider];
                                    return (
                                    <button
                                        key={provider}
                                        className={`io-btn ${cloudImportProvider === provider ? 'primary' : 'secondary'}`}
                                        onClick={() => handleBrowseCloudFiles(provider)}
                                    >
                                        {ProvIcon && <ProvIcon width={16} height={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.25rem' }} />}
                                        {PROVIDER_CONFIG[provider].name}
                                    </button>
                                    );
                                })}
                            </div>
                            {cloudImportProvider && (
                                <div className="cloud-files-list">
                                    {loadingCloudFiles && <div className="cloud-files-loading">{t('loading')}...</div>}
                                    {!loadingCloudFiles && cloudFiles.length === 0 && (
                                        <div className="cloud-files-empty">{t('cloudNoFiles')}</div>
                                    )}
                                    {!loadingCloudFiles && cloudFiles.map(file => (
                                        <div key={file.id} className="cloud-file-row">
                                            <div className="cloud-file-info">
                                                <span className="cloud-file-name">{file.name}</span>
                                                <span className="cloud-file-meta">
                                                    {formatFileSize(file.size)} · {formatCloudDate(file.modifiedAt)}
                                                </span>
                                            </div>
                                            <button
                                                className="io-btn secondary"
                                                onClick={() => handleCloudFileImport(cloudImportProvider, file)}
                                                disabled={importingCloudFile === file.id}
                                            >
                                                {importingCloudFile === file.id ? t('importing') : t('import')}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>

            {/* Cloud Sync Section */}
            {!cloudLoading && connectedProviders.length > 0 && (
                <section className="io-section cloud-sync-section">
                    <h3>{t('cloudSync')}</h3>
                    <p className="section-description">{t('cloudSyncDescription')}</p>

                    <div className="cloud-sync-grid">
                        {connectedProviders.map(provider => {
                            const config = PROVIDER_CONFIG[provider];
                            const schedule = schedules[provider];
                            const IconComponent = CLOUD_PROVIDER_ICONS[provider];

                            return (
                                <div key={provider} className="cloud-sync-card">
                                    <div className="cloud-sync-card-header">
                                        <span className="cloud-sync-card-icon">{IconComponent && <IconComponent width={20} height={20} />}</span>
                                        <span className="cloud-sync-card-name">{config.name}</span>
                                        {schedule?.enabled && <span className="cloud-sync-active-dot" />}
                                    </div>

                                    {/* Upload */}
                                    <div className="cloud-sync-row">
                                        <div className="cloud-sync-upload-options">
                                            <div className="cloud-upload-row">
                                                <label>{t('exportFormat')}</label>
                                                <select
                                                    value={cloudExportFormat}
                                                    onChange={e => setCloudExportFormat(e.target.value as ImportExportFormat)}
                                                >
                                                    <option value="txt">{t('formatTxt')}</option>
                                                    <option value="json">{t('formatJson')}</option>
                                                    <option value="md">{t('formatMd')}</option>
                                                </select>
                                            </div>
                                            <label className="checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={cloudIncludeVisibility}
                                                    onChange={() => setCloudIncludeVisibility(!cloudIncludeVisibility)}
                                                />
                                                {t('includeVisibility')}
                                            </label>
                                        </div>
                                        <button
                                            className="io-btn primary"
                                            onClick={() => handleCloudUpload(provider)}
                                            disabled={uploading === provider}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                            {uploading === provider ? t('cloudUploading') : t('cloudUpload')}
                                        </button>
                                    </div>

                                    {/* Schedule */}
                                    <div className="cloud-sync-schedule">
                                        <h4>{t('cloudSchedule')}</h4>
                                        <p className="section-description">{t('cloudScheduleDescription')}</p>

                                        {schedule?.enabled && (
                                            <div className="cloud-schedule-status active">
                                                <span className="cloud-schedule-status-dot" />
                                                {t('cloudScheduleEnabled')}
                                            </div>
                                        )}

                                        {schedule?.lastSyncAt && (
                                            <div className="cloud-schedule-meta">{t('cloudLastSync', { date: formatCloudDate(schedule.lastSyncAt) })}</div>
                                        )}
                                        {schedule?.nextSyncAt && schedule?.enabled && (
                                            <div className="cloud-schedule-meta">{t('cloudNextSync', { date: formatCloudDate(schedule.nextSyncAt) })}</div>
                                        )}

                                        <div className="cloud-upload-row">
                                            <label>{t('cloudScheduleFrequency')}</label>
                                            <select
                                                value={scheduleFrequency[provider]}
                                                onChange={e => setScheduleFrequency(prev => ({ ...prev, [provider]: e.target.value as SyncFrequency }))}
                                            >
                                                <option value="every_6h">{t('cloudScheduleEvery6h')}</option>
                                                <option value="every_12h">{t('cloudScheduleEvery12h')}</option>
                                                <option value="daily">{t('cloudScheduleDaily')}</option>
                                                <option value="weekly">{t('cloudScheduleWeekly')}</option>
                                            </select>
                                        </div>

                                        <div className="cloud-upload-row">
                                            <label>{t('exportFormat')}</label>
                                            <select
                                                value={scheduleFormat[provider]}
                                                onChange={e => setScheduleFormat(prev => ({ ...prev, [provider]: e.target.value as ImportExportFormat }))}
                                            >
                                                <option value="txt">{t('formatTxt')}</option>
                                                <option value="json">{t('formatJson')}</option>
                                                <option value="md">{t('formatMd')}</option>
                                            </select>
                                        </div>

                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={scheduleIncludeVisibility[provider]}
                                                onChange={() => setScheduleIncludeVisibility(prev => ({ ...prev, [provider]: !prev[provider] }))}
                                            />
                                            {t('includeVisibility')}
                                        </label>

                                        <div className="cloud-schedule-actions">
                                            <button className="io-btn primary" onClick={() => handleSaveSchedule(provider)}>
                                                {t('cloudScheduleEnable')}
                                            </button>
                                            {schedule?.enabled && (
                                                <button className="io-btn danger" onClick={() => handleRemoveSchedule(provider)}>
                                                    {t('cloudScheduleDisable')}
                                                </button>
                                            )}
                                            <button
                                                className="io-btn secondary"
                                                onClick={() => handleSyncNow(provider)}
                                                disabled={syncing === provider}
                                            >
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
            )}

            {/* Format Configuration Section */}
            <section className="io-section format-section">
                <h3>{t('formatSettings')}</h3>
                <p className="section-description">{t('formatDescription')}</p>

                <div className="format-grid">
                    <div className="format-row format-row--separators">
                        <div className="format-field">
                            <label>{t('entrySeparator')}</label>
                            <div className="input-with-count">
                                <input
                                    type="text"
                                    value={formatConfig.entrySeparator}
                                    onChange={(e) => handleInputChange('entrySeparator', e.target.value)}
                                />
                                <span className="char-count">{formatConfig.entrySeparator.length}</span>
                            </div>
                        </div>
                        <div className="format-field">
                            <label>{t('sameDaySeparator')}</label>
                            <div className="input-with-count">
                                <input
                                    type="text"
                                    value={formatConfig.sameDaySeparator}
                                    onChange={(e) => handleInputChange('sameDaySeparator', e.target.value)}
                                />
                                <span className="char-count">{formatConfig.sameDaySeparator.length}</span>
                            </div>
                        </div>
                    </div>
                    <div className="format-row format-row--compact">
                        <div className="format-field format-field--compact">
                            <label>{t('datePrefix')}</label>
                            <input
                                type="text"
                                value={formatConfig.datePrefix}
                                onChange={(e) => handleInputChange('datePrefix', e.target.value)}
                            />
                        </div>
                        <div className="format-field format-field--compact">
                            <label>{t('dateSuffix')}</label>
                            <input
                                type="text"
                                value={formatConfig.dateSuffix}
                                onChange={(e) => handleInputChange('dateSuffix', e.target.value)}
                            />
                        </div>
                        <div className="format-field format-field--compact">
                            <label>{t('tagOpenBracket')}</label>
                            <input
                                type="text"
                                value={formatConfig.tagOpenBracket}
                                onChange={(e) => handleInputChange('tagOpenBracket', e.target.value)}
                                maxLength={2}
                            />
                        </div>
                        <div className="format-field format-field--compact">
                            <label>{t('tagCloseBracket')}</label>
                            <input
                                type="text"
                                value={formatConfig.tagCloseBracket}
                                onChange={(e) => handleInputChange('tagCloseBracket', e.target.value)}
                                maxLength={2}
                            />
                        </div>
                        <div className="format-field format-field--compact">
                            <label>{t('tagSeparator')}</label>
                            <input
                                type="text"
                                value={formatConfig.tagSeparator}
                                onChange={(e) => handleInputChange('tagSeparator', e.target.value)}
                                maxLength={2}
                            />
                        </div>
                        <div className="format-field format-field--compact">
                            <label>{t('dateFormat')}</label>
                            <select
                                value={formatConfig.dateFormat}
                                onChange={(e) => handleInputChange('dateFormat', e.target.value)}
                            >
                                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                                <option value="MM-DD-YYYY">MM-DD-YYYY</option>
                                <option value="YYYY/MM/DD">YYYY/MM/DD</option>
                                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                            </select>
                        </div>
                    </div>
                </div>

                <button className="io-btn secondary" onClick={saveFormatSettings}>
                    {t('saveFormat')}
                </button>
            </section>

            {/* Danger Zone */}
            <section className="io-section danger-zone">
                <h3>{t('dangerZone')}</h3>
                <p className="section-description">{t('deleteAllDescription', { diaryName: diaryName || '' })}</p>
                <div className="danger-actions">
                    {confirmDeleteAll && (
                        <button
                            className="io-btn secondary"
                            onClick={() => setConfirmDeleteAll(false)}
                        >
                            {t('cancel')}
                        </button>
                    )}
                    <button
                        className="io-btn danger"
                        onClick={handleDeleteAll}
                        disabled={deleting}
                    >
                        {deleteAllLabel}
                    </button>
                </div>
            </section>
        </div>
    );
}

export default ImportExport;
