import { useCallback, useEffect, useState } from 'react';
import { useApiServices } from '../../hooks/useAppState';
import type { CloudExportFormat, TranslationFunction } from '../../types';
import type { CloudFileInfo, CloudProviderType, CloudStatus, SyncFrequency, SyncScheduleConfig } from '../../services/api/cloudSyncService';
import { CLOUD_PROVIDERS, createProviderRecord, type MessageState } from './ImportExport.types';

interface UseImportExportCloudOptions {
    readonly diaryId?: number | null;
    readonly showMessage: (type: MessageState['type'], text: string) => void;
    readonly previewImportContent: (content: string, successText?: string) => Promise<void>;
    readonly t: TranslationFunction;
}

/** Cloud provider status, one-off uploads, scheduled syncs, and imports from cloud files. */
export function useImportExportCloud({ diaryId, showMessage, previewImportContent, t }: UseImportExportCloudOptions) {
    const { cloudSyncService } = useApiServices();
    const [cloudStatus, setCloudStatus] = useState<Partial<CloudStatus>>({});
    const [cloudLoading, setCloudLoading] = useState(true);
    const [uploading, setUploading] = useState<CloudProviderType | null>(null);
    const [syncing, setSyncing] = useState<CloudProviderType | null>(null);
    const [schedules, setSchedules] = useState<Record<string, SyncScheduleConfig>>({});
    const [scheduleFrequency, setScheduleFrequency] = useState<Record<string, SyncFrequency>>(createProviderRecord('daily'));
    const [scheduleFormat, setScheduleFormat] = useState<Record<string, CloudExportFormat>>(createProviderRecord('txt'));
    const [scheduleIncludeVisibility, setScheduleIncludeVisibility] = useState<Record<string, boolean>>(createProviderRecord(false));
    const [cloudExportFormat, setCloudExportFormat] = useState<CloudExportFormat>('txt');
    const [cloudIncludeVisibility, setCloudIncludeVisibility] = useState(false);
    const [cloudImportProvider, setCloudImportProvider] = useState<CloudProviderType | null>(null);
    const [cloudFiles, setCloudFiles] = useState<CloudFileInfo[]>([]);
    const [loadingCloudFiles, setLoadingCloudFiles] = useState(false);
    const [importingCloudFile, setImportingCloudFile] = useState<string | null>(null);
    const connectedProviders = CLOUD_PROVIDERS.filter((provider) => cloudStatus[provider]?.connected);

    /** Shows a refused cloud request: the API's translated reason, or the call's own fallback message. */
    function showError(error: string | null): void {
        showMessage('error', t(error ?? 'cloudSyncError'));
    }

    const fetchCloudStatus = useCallback(async (): Promise<void> => {
        const { data } = await cloudSyncService.getStatus();
        if (data) {
            setCloudStatus(data);
        }
        setCloudLoading(false);
    }, [cloudSyncService]);

    const fetchSchedules = useCallback(async (): Promise<void> => {
        const { data } = await cloudSyncService.getSchedules();
        if (!data) {
            return;
        }

        setSchedules(data);
        const nextFrequency = createProviderRecord<SyncFrequency>('daily');
        const nextFormat = createProviderRecord<CloudExportFormat>('txt');
        const nextIncludeVisibility = createProviderRecord(false);

        for (const provider of CLOUD_PROVIDERS) {
            const config = data[provider];
            if (!config) {
                continue;
            }
            if (config.frequency) {
                nextFrequency[provider] = config.frequency;
            }
            if (config.format) {
                nextFormat[provider] = config.format as CloudExportFormat;
            }
            if (config.includeVisibility !== undefined) {
                nextIncludeVisibility[provider] = config.includeVisibility;
            }
        }

        setScheduleFrequency(nextFrequency);
        setScheduleFormat(nextFormat);
        setScheduleIncludeVisibility(nextIncludeVisibility);
    }, [cloudSyncService]);

    useEffect(() => {
        void fetchCloudStatus();
        void fetchSchedules();
    }, [fetchCloudStatus, fetchSchedules]);

    async function handleCloudUpload(provider: CloudProviderType): Promise<void> {
        setUploading(provider);
        const { data: file, error } = await cloudSyncService.uploadExport(provider, {
            diaryId: diaryId ?? undefined,
            format: cloudExportFormat,
            includeVisibility: cloudIncludeVisibility,
        });
        if (file) {
            showMessage('success', t('cloudUploadSuccess', { name: file.name }));
        } else {
            showError(error);
        }
        setUploading(null);
    }

    async function handleSaveSchedule(provider: CloudProviderType): Promise<void> {
        const { error } = await cloudSyncService.setSchedule(provider, {
            frequency: scheduleFrequency[provider] || 'daily',
            format: scheduleFormat[provider],
            diaryId: diaryId ?? undefined,
            includeVisibility: scheduleIncludeVisibility[provider],
        });
        if (error) {
            showError(error);
            return;
        }
        showMessage('success', t('cloudScheduleSaved'));
        await fetchSchedules();
    }

    async function handleRemoveSchedule(provider: CloudProviderType): Promise<void> {
        const { error } = await cloudSyncService.deleteSchedule(provider);
        if (error) {
            showError(error);
            return;
        }
        showMessage('success', t('cloudScheduleRemoved'));
        await fetchSchedules();
    }

    async function handleSyncNow(provider: CloudProviderType): Promise<void> {
        setSyncing(provider);
        const { data: result, error } = await cloudSyncService.triggerSync(provider);
        if (result) {
            showMessage('success', result.synced ? t('cloudSyncSuccess', { name: result.file?.name || '' }) : t('cloudSyncNoChanges'));
            await fetchSchedules();
        } else {
            showError(error);
        }
        setSyncing(null);
    }

    async function handleBrowseCloudFiles(provider: CloudProviderType): Promise<void> {
        if (cloudImportProvider === provider) {
            setCloudImportProvider(null);
            setCloudFiles([]);
            return;
        }
        setCloudImportProvider(provider);
        setLoadingCloudFiles(true);
        const { data: files, error } = await cloudSyncService.listFiles(provider);
        setCloudFiles(files ?? []);
        if (error) {
            showError(error);
        }
        setLoadingCloudFiles(false);
    }

    async function handleCloudFileImport(provider: CloudProviderType, file: CloudFileInfo): Promise<void> {
        setImportingCloudFile(file.id);
        const { data: content, error } = await cloudSyncService.downloadFile(provider, file.id);
        if (content) {
            await previewImportContent(content, t('cloudDownloadSuccess', { name: file.name }));
        } else {
            showError(error);
        }
        setImportingCloudFile(null);
    }

    return {
        connectedProviders,
        importProps: {
            cloudLoading,
            connectedProviders,
            cloudImportProvider,
            cloudFiles,
            loadingCloudFiles,
            importingCloudFile,
            onBrowseCloudFiles: handleBrowseCloudFiles,
            onImportCloudFile: handleCloudFileImport,
        },
        syncProps: {
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
            onUpload: handleCloudUpload,
            onSaveSchedule: handleSaveSchedule,
            onRemoveSchedule: handleRemoveSchedule,
            onSyncNow: handleSyncNow,
        },
    };
}
