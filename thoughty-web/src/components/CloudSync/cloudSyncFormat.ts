import type { CloudProviderType } from '../../services/api/cloudSyncService';
import { CLOUD_PROVIDER_NAMES } from '../CloudProviderIcons';

export type ExportFormat = 'txt' | 'json' | 'md';

export const PROVIDER_CONFIG: Record<CloudProviderType, { name: string }> = {
    google_drive: { name: CLOUD_PROVIDER_NAMES.google_drive },
    onedrive: { name: CLOUD_PROVIDER_NAMES.onedrive },
    dropbox: { name: CLOUD_PROVIDER_NAMES.dropbox },
};

export const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatDate = (dateStr: string): string => {
    try {
        return new Date(dateStr).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return dateStr;
    }
};
