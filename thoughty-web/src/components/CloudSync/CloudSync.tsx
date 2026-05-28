import { useState, useEffect, useCallback, useRef } from 'react';
import './CloudSync.css';
import { useApiServices } from '../../hooks/useAppState';
import type { CloudProviderType, CloudFileInfo, SyncScheduleConfig, SyncFrequency } from '../../services/api/cloudSyncService';
import { CLOUD_PROVIDER_ICONS, CLOUD_PROVIDER_NAMES } from '../CloudProviderIcons';
import { downloadBlob } from '../../utils/downloadFile';

type ExportFormat = 'txt' | 'json' | 'md';

interface CloudSyncProps {
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
    readonly diaryId?: number | null;
}

interface CloudProviderStatus {
    connected: boolean;
    connectedAt?: string;
}

interface MessageState {
    type: 'success' | 'error';
    text: string;
}

const MESSAGE_TIMEOUT_MS = 4000;

const PROVIDER_CONFIG: Record<CloudProviderType, { name: string }> = {
    google_drive: { name: CLOUD_PROVIDER_NAMES.google_drive },
    onedrive: { name: CLOUD_PROVIDER_NAMES.onedrive },
    dropbox: { name: CLOUD_PROVIDER_NAMES.dropbox },
};

function CloudSync({ theme, t, diaryId }: CloudSyncProps) {
    const { cloudSyncService } = useApiServices();
    const [status, setStatus] = useState<Record<string, CloudProviderStatus>>({});
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState<CloudProviderType | null>(null);
    const [uploading, setUploading] = useState<CloudProviderType | null>(null);
    const [message, setMessage] = useState<MessageState | null>(null);
    const [exportFormat, setExportFormat] = useState<ExportFormat>('txt');
    const [includeVisibility, setIncludeVisibility] = useState(false);
    const [expandedProvider, setExpandedProvider] = useState<CloudProviderType | null>(null);
    const [files, setFiles] = useState<CloudFileInfo[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [schedules, setSchedules] = useState<Record<string, SyncScheduleConfig>>({});
    const [scheduleFrequency, setScheduleFrequency] = useState<Record<string, SyncFrequency>>({
        google_drive: 'daily',
        onedrive: 'daily',
        dropbox: 'daily',
    });
    const [scheduleFormat, setScheduleFormat] = useState<Record<string, ExportFormat>>({
        google_drive: 'txt',
        onedrive: 'txt',
        dropbox: 'txt',
    });
    const [scheduleIncludeVisibility, setScheduleIncludeVisibility] = useState<Record<string, boolean>>({
        google_drive: false,
        onedrive: false,
        dropbox: false,
    });
    const [syncing, setSyncing] = useState<CloudProviderType | null>(null);
    const messageTimeoutRef = useRef<number | null>(null);

    const isLight = theme === 'light';

    const fetchStatus = useCallback(async () => {
        const data = await cloudSyncService.getStatus();
        if (data) setStatus(data as unknown as Record<string, CloudProviderStatus>);
        setLoading(false);
    }, [cloudSyncService]);

    const fetchSchedules = useCallback(async () => {
        const data = await cloudSyncService.getSchedules();
        if (data) {
            setSchedules(data);
            // Initialize form state from saved schedules
            for (const [provider, config] of Object.entries(data)) {
                if (config.frequency) {
                    setScheduleFrequency(prev => ({ ...prev, [provider]: config.frequency as SyncFrequency }));
                }
                if (config.format) {
                    setScheduleFormat(prev => ({ ...prev, [provider]: config.format as ExportFormat }));
                }
                if (config.includeVisibility !== undefined) {
                    setScheduleIncludeVisibility(prev => ({ ...prev, [provider]: config.includeVisibility! }));
                }
            }
        }
    }, [cloudSyncService]);

    useEffect(() => {
        fetchStatus();
        fetchSchedules();
    }, [fetchStatus, fetchSchedules]);

    useEffect(() => () => {
        if (messageTimeoutRef.current !== null) {
            globalThis.clearTimeout(messageTimeoutRef.current);
        }
    }, []);

    const showMessage = useCallback((type: MessageState['type'], text: string) => {
        setMessage({ type, text });

        if (messageTimeoutRef.current !== null) {
            globalThis.clearTimeout(messageTimeoutRef.current);
        }

        messageTimeoutRef.current = globalThis.setTimeout(() => {
            setMessage(null);
            messageTimeoutRef.current = null;
        }, MESSAGE_TIMEOUT_MS);
    }, []);

    // Listen for OAuth callback messages
    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            if (event.data?.type === 'cloud-oauth-callback') {
                const { provider, code } = event.data;
                if (!provider || !code) return;

                setConnecting(provider);
                const redirectUri = `${globalThis.location.origin}/cloud-callback`;
                const success = await cloudSyncService.connect(provider, code, redirectUri);
                if (success) {
                    showMessage('success', t('cloudConnected', { provider: PROVIDER_CONFIG[provider as CloudProviderType]?.name || provider }));
                    await fetchStatus();
                } else {
                    showMessage('error', t('cloudConnectError'));
                }
                setConnecting(null);
            }
        };

        globalThis.addEventListener('message', handleMessage);
        return () => globalThis.removeEventListener('message', handleMessage);
    }, [cloudSyncService, fetchStatus, showMessage, t]);

    const handleSaveSchedule = async (provider: CloudProviderType) => {
        const success = await cloudSyncService.setSchedule(provider, {
            frequency: scheduleFrequency[provider] || 'daily',
            format: scheduleFormat[provider],
            diaryId: diaryId ?? undefined,
            includeVisibility: scheduleIncludeVisibility[provider],
        });
        if (success) {
            showMessage('success', t('cloudScheduleSaved'));
            await fetchSchedules();
        } else {
            showMessage('error', t('cloudScheduleSaveError'));
        }
    };

    const handleRemoveSchedule = async (provider: CloudProviderType) => {
        const success = await cloudSyncService.deleteSchedule(provider);
        if (success) {
            showMessage('success', t('cloudScheduleRemoved'));
            await fetchSchedules();
        } else {
            showMessage('error', t('cloudScheduleRemoveError'));
        }
    };

    const handleSyncNow = async (provider: CloudProviderType) => {
        setSyncing(provider);
        const result = await cloudSyncService.triggerSync(provider);
        if (result) {
            if (result.synced) {
                showMessage('success', t('cloudSyncSuccess', { name: result.file?.name || '' }));
            } else {
                showMessage('success', t('cloudSyncNoChanges'));
            }
            await fetchSchedules();
        } else {
            showMessage('error', t('cloudSyncError'));
        }
        setSyncing(null);
    };

    const handleConnect = async (provider: CloudProviderType) => {
        setConnecting(provider);
        const redirectUri = `${globalThis.location.origin}/cloud-callback`;
        const authUrl = await cloudSyncService.getAuthUrl(provider, redirectUri);
        if (authUrl) {
            // Open OAuth in a popup
            const width = 600;
            const height = 700;
            const left = globalThis.screenX + (globalThis.outerWidth - width) / 2;
            const top = globalThis.screenY + (globalThis.outerHeight - height) / 2;
            globalThis.open(authUrl, 'cloud-oauth', `width=${width},height=${height},left=${left},top=${top}`);
        } else {
            showMessage('error', t('cloudConnectError'));
            setConnecting(null);
        }
    };

    const handleDisconnect = async (provider: CloudProviderType) => {
        const success = await cloudSyncService.disconnect(provider);
        if (success) {
            showMessage('success', t('cloudDisconnected', { provider: PROVIDER_CONFIG[provider]?.name || provider }));
            await fetchStatus();
            if (expandedProvider === provider) {
                setExpandedProvider(null);
                setFiles([]);
            }
        } else {
            showMessage('error', t('cloudDisconnectError'));
        }
    };

    const handleUpload = async (provider: CloudProviderType) => {
        setUploading(provider);
        const result = await cloudSyncService.uploadExport(provider, {
            diaryId: diaryId ?? undefined,
            format: exportFormat,
            includeVisibility,
        });
        if (result) {
            showMessage('success', t('cloudUploadSuccess', { name: result.name }));
            // Refresh files if viewing
            if (expandedProvider === provider) {
                await loadFiles(provider);
            }
        } else {
            showMessage('error', t('cloudUploadError'));
        }
        setUploading(null);
    };

    const loadFiles = async (provider: CloudProviderType) => {
        setLoadingFiles(true);
        const data = await cloudSyncService.listFiles(provider);
        setFiles(data);
        setLoadingFiles(false);
    };

    const handleBrowseFiles = async (provider: CloudProviderType) => {
        if (expandedProvider === provider) {
            setExpandedProvider(null);
            setFiles([]);
            return;
        }
        setExpandedProvider(provider);
        await loadFiles(provider);
    };

    const handleDownload = async (provider: CloudProviderType, file: CloudFileInfo) => {
        setDownloading(file.id);
        const content = await cloudSyncService.downloadFile(provider, file.id);
        if (content) {
            // Trigger browser download
            const blob = new Blob([content], { type: 'text/plain; charset=utf-8' });
            downloadBlob(blob, file.name);
            showMessage('success', t('cloudDownloadSuccess', { name: file.name }));
        } else {
            showMessage('error', t('cloudDownloadError'));
        }
        setDownloading(null);
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateStr: string): string => {
        try {
            return new Date(dateStr).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
        } catch {
            return dateStr;
        }
    };

    if (loading) {
        return <div className={`cloud-sync ${isLight ? 'light' : 'dark'}`}>{t('loading')}...</div>;
    }

    return (
        <div className={`cloud-sync ${isLight ? 'light' : 'dark'}`}>
            <h3>{t('cloudSync')}</h3>
            <p className="cloud-sync-description">{t('cloudSyncDescription')}</p>

            {message && (
                <div className={`cloud-message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="cloud-providers">
                {(Object.keys(PROVIDER_CONFIG) as CloudProviderType[]).map(provider => {
                    const config = PROVIDER_CONFIG[provider];
                    const providerStatus = status[provider];
                    const isConnected = providerStatus?.connected ?? false;
                    const IconComponent = CLOUD_PROVIDER_ICONS[provider];

                    return (
                        <div key={provider} className={`cloud-provider-card ${isConnected ? 'connected' : ''}`}>
                            <div className="cloud-provider-header">
                                <div className="cloud-provider-icon">{IconComponent && <IconComponent width={24} height={24} />}</div>
                                <div className="cloud-provider-info">
                                    <div className="cloud-provider-name">{config.name}</div>
                                    <div className={`cloud-provider-status ${isConnected ? 'connected' : ''}`}>
                                        {isConnected
                                            ? t('cloudStatusConnected', { date: providerStatus?.connectedAt ? formatDate(providerStatus.connectedAt) : '' })
                                            : t('cloudStatusDisconnected')
                                        }
                                    </div>
                                </div>
                            </div>

                            <div className="cloud-provider-actions">
                                {isConnected ? (
                                    <>
                                        <button
                                            className="cloud-btn sync"
                                            onClick={() => handleUpload(provider)}
                                            disabled={uploading === provider}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                            {uploading === provider ? t('cloudUploading') : t('cloudUpload')}
                                        </button>
                                        <button
                                            className="cloud-btn browse"
                                            onClick={() => handleBrowseFiles(provider)}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                            </svg>
                                            {t('cloudBrowseFiles')}
                                        </button>
                                        <button
                                            className="cloud-btn disconnect"
                                            onClick={() => handleDisconnect(provider)}
                                        >
                                            {t('cloudDisconnect')}
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        className="cloud-btn connect"
                                        onClick={() => handleConnect(provider)}
                                        disabled={connecting === provider}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                        </svg>
                                        {connecting === provider ? t('cloudConnecting') : t('cloudConnect')}
                                    </button>
                                )}
                            </div>

                            {/* Upload options shown when connected */}
                            {isConnected && (
                                <div className="cloud-upload-options">
                                    <h4>{t('cloudUploadOptions')}</h4>
                                    <div className="cloud-upload-row">
                                        <label>{t('exportFormat')}</label>
                                        <select
                                            value={exportFormat}
                                            onChange={e => setExportFormat(e.target.value as ExportFormat)}
                                        >
                                            <option value="txt">{t('formatTxt')}</option>
                                            <option value="json">{t('formatJson')}</option>
                                            <option value="md">{t('formatMd')}</option>
                                        </select>
                                    </div>
                                    <div className="cloud-upload-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={includeVisibility}
                                                onChange={() => setIncludeVisibility(!includeVisibility)}
                                            />
                                            {t('includeVisibility')}
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Scheduled Sync section shown when connected */}
                            {isConnected && (
                                <div className="cloud-schedule-section">
                                    <h4>{t('cloudSchedule')}</h4>
                                    <p className="cloud-schedule-description">{t('cloudScheduleDescription')}</p>

                                    {schedules[provider]?.enabled && (
                                        <div className="cloud-schedule-status active">
                                            <span className="cloud-schedule-status-dot" />
                                            {t('cloudScheduleEnabled')}
                                        </div>
                                    )}

                                    {schedules[provider]?.lastSyncAt && (
                                        <div className="cloud-schedule-meta">
                                            {t('cloudLastSync', { date: formatDate(schedules[provider].lastSyncAt) })}
                                        </div>
                                    )}
                                    {schedules[provider]?.nextSyncAt && schedules[provider]?.enabled && (
                                        <div className="cloud-schedule-meta">
                                            {t('cloudNextSync', { date: formatDate(schedules[provider].nextSyncAt) })}
                                        </div>
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
                                            onChange={e => setScheduleFormat(prev => ({ ...prev, [provider]: e.target.value as ExportFormat }))}
                                        >
                                            <option value="txt">{t('formatTxt')}</option>
                                            <option value="json">{t('formatJson')}</option>
                                            <option value="md">{t('formatMd')}</option>
                                        </select>
                                    </div>

                                    <div className="cloud-upload-row">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={scheduleIncludeVisibility[provider]}
                                                onChange={() => setScheduleIncludeVisibility(prev => ({ ...prev, [provider]: !prev[provider] }))}
                                            />
                                            {t('includeVisibility')}
                                        </label>
                                    </div>

                                    <div className="cloud-schedule-actions">
                                        <button
                                            className="cloud-btn sync"
                                            onClick={() => handleSaveSchedule(provider)}
                                        >
                                            {t('cloudScheduleEnable')}
                                        </button>
                                        {schedules[provider]?.enabled && (
                                            <button
                                                className="cloud-btn disconnect"
                                                onClick={() => handleRemoveSchedule(provider)}
                                            >
                                                {t('cloudScheduleDisable')}
                                            </button>
                                        )}
                                        <button
                                            className="cloud-btn browse"
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
                            )}

                            {/* Files list */}
                            {expandedProvider === provider && (
                                <div className="cloud-files-section">
                                    <h4>{t('cloudFilesInCloud', { provider: config.name })}</h4>
                                    {loadingFiles && (
                                        <div className="cloud-no-files">{t('loading')}...</div>
                                    )}
                                    {!loadingFiles && files.length === 0 && (
                                        <div className="cloud-no-files">{t('cloudNoFiles')}</div>
                                    )}
                                    {!loadingFiles && files.length > 0 && (
                                        <div className="cloud-files-list">
                                            {files.map(file => (
                                                <div key={file.id} className="cloud-file-item">
                                                    <div className="cloud-file-icon">
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                    </div>
                                                    <div className="cloud-file-info">
                                                        <div className="cloud-file-name">{file.name}</div>
                                                        <div className="cloud-file-meta">
                                                            {formatFileSize(file.size)} · {formatDate(file.modifiedAt)}
                                                        </div>
                                                    </div>
                                                    <div className="cloud-file-actions">
                                                        <button
                                                            className="cloud-btn browse"
                                                            onClick={() => handleDownload(provider, file)}
                                                            disabled={downloading === file.id}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                            </svg>
                                                            {downloading === file.id ? t('downloading') : t('cloudDownload')}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default CloudSync;
