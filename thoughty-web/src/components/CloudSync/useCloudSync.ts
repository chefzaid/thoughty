import { useState, useEffect, useCallback, useRef } from 'react';
import { useApiServices } from '../../hooks/useAppState';
import type { CloudProviderType, CloudFileInfo, SyncScheduleConfig, SyncFrequency } from '../../services/api/cloudSyncService';
import { downloadBlob } from '../../utils/downloadFile';
import { PROVIDER_CONFIG, type ExportFormat } from './cloudSyncFormat';

type Translate = (key: string, params?: Record<string, string | number>) => string;

export interface CloudProviderStatus {
    connected: boolean;
    connectedAt?: string;
}

export interface MessageState {
    type: 'success' | 'error';
    text: string;
}

const MESSAGE_TIMEOUT_MS = 4000;

/**
 * State and actions behind the cloud sync panel: provider connections (OAuth popup), one-off
 * uploads, the file browser and scheduled syncs, with a transient status message.
 */
export function useCloudSync(t: Translate, diaryId: number | null | undefined) {
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

    return {
        status,
        loading,
        connecting,
        uploading,
        message,
        exportFormat,
        setExportFormat,
        includeVisibility,
        setIncludeVisibility,
        expandedProvider,
        files,
        loadingFiles,
        downloading,
        schedules,
        scheduleFrequency,
        setScheduleFrequency,
        scheduleFormat,
        setScheduleFormat,
        scheduleIncludeVisibility,
        setScheduleIncludeVisibility,
        syncing,
        handleSaveSchedule,
        handleRemoveSchedule,
        handleSyncNow,
        handleConnect,
        handleDisconnect,
        handleUpload,
        handleBrowseFiles,
        handleDownload,
    };
}
