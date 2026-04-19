import { safeJsonParse } from './base';

export type CloudProviderType = 'google_drive' | 'onedrive' | 'dropbox';

export interface CloudFileInfo {
  id: string;
  name: string;
  size: number;
  modifiedAt: string;
}

export interface CloudStatus {
  google_drive: { connected: boolean; connectedAt?: string };
  onedrive: { connected: boolean; connectedAt?: string };
  dropbox: { connected: boolean; connectedAt?: string };
}

export type SyncFrequency = 'every_6h' | 'every_12h' | 'daily' | 'weekly';

export interface SyncScheduleConfig {
  enabled: boolean;
  frequency?: SyncFrequency;
  format?: string;
  diaryId?: number;
  includeVisibility?: boolean;
  lastSyncAt?: string;
  lastSyncHash?: string;
  nextSyncAt?: string;
}

export type SyncSchedules = Record<string, SyncScheduleConfig>;

export interface DiffSyncResult {
  synced: boolean;
  message: string;
  file?: CloudFileInfo;
}

export const createCloudSyncService = (authFetch: (url: string, options?: RequestInit) => Promise<Response>) => {
  const getStatus = async (): Promise<CloudStatus | null> => {
    try {
      const response = await authFetch('/api/cloud-sync/status');
      if (!response?.ok) return null;
      return safeJsonParse<CloudStatus>(response);
    } catch (error) {
      console.error('Error fetching cloud status:', error);
      return null;
    }
  };

  const getAuthUrl = async (provider: CloudProviderType, redirectUri: string): Promise<string | null> => {
    try {
      const response = await authFetch('/api/cloud-sync/auth-url', {
        method: 'POST',
        body: JSON.stringify({ provider, redirectUri }),
      });
      if (!response?.ok) return null;
      const data = await safeJsonParse<{ url: string }>(response);
      return data?.url || null;
    } catch (error) {
      console.error('Error getting auth URL:', error);
      return null;
    }
  };

  const connect = async (provider: CloudProviderType, code: string, redirectUri: string): Promise<boolean> => {
    try {
      const response = await authFetch('/api/cloud-sync/connect', {
        method: 'POST',
        body: JSON.stringify({ provider, code, redirectUri }),
      });
      return response?.ok ?? false;
    } catch (error) {
      console.error('Error connecting provider:', error);
      return false;
    }
  };

  const disconnect = async (provider: CloudProviderType): Promise<boolean> => {
    try {
      const response = await authFetch('/api/cloud-sync/disconnect', {
        method: 'POST',
        body: JSON.stringify({ provider }),
      });
      return response?.ok ?? false;
    } catch (error) {
      console.error('Error disconnecting provider:', error);
      return false;
    }
  };

  const listFiles = async (provider: CloudProviderType): Promise<CloudFileInfo[]> => {
    try {
      const response = await authFetch(`/api/cloud-sync/files?provider=${provider}`);
      if (!response?.ok) return [];
      return (await safeJsonParse<CloudFileInfo[]>(response)) || [];
    } catch (error) {
      console.error('Error listing cloud files:', error);
      return [];
    }
  };

  const uploadExport = async (
    provider: CloudProviderType,
    options?: { diaryId?: number; format?: 'txt' | 'json' | 'md'; includeVisibility?: boolean },
  ): Promise<CloudFileInfo | null> => {
    try {
      const response = await authFetch('/api/cloud-sync/upload', {
        method: 'POST',
        body: JSON.stringify({ provider, ...options }),
      });
      if (!response?.ok) return null;
      return safeJsonParse<CloudFileInfo>(response);
    } catch (error) {
      console.error('Error uploading to cloud:', error);
      return null;
    }
  };

  const downloadFile = async (provider: CloudProviderType, fileId: string): Promise<string | null> => {
    try {
      const response = await authFetch('/api/cloud-sync/download', {
        method: 'POST',
        body: JSON.stringify({ provider, fileId }),
      });
      if (!response?.ok) return null;
      const data = await safeJsonParse<{ content: string }>(response);
      return data?.content || null;
    } catch (error) {
      console.error('Error downloading from cloud:', error);
      return null;
    }
  };

  const getSchedules = async (): Promise<SyncSchedules | null> => {
    try {
      const response = await authFetch('/api/cloud-sync/schedules');
      if (!response?.ok) return null;
      return safeJsonParse<SyncSchedules>(response);
    } catch (error) {
      console.error('Error fetching sync schedules:', error);
      return null;
    }
  };

  const setSchedule = async (
    provider: CloudProviderType,
    config: { frequency: SyncFrequency; format?: string; diaryId?: number; includeVisibility?: boolean },
  ): Promise<boolean> => {
    try {
      const response = await authFetch('/api/cloud-sync/schedule', {
        method: 'POST',
        body: JSON.stringify({ provider, ...config }),
      });
      return response?.ok ?? false;
    } catch (error) {
      console.error('Error setting sync schedule:', error);
      return false;
    }
  };

  const deleteSchedule = async (provider: CloudProviderType): Promise<boolean> => {
    try {
      const response = await authFetch(`/api/cloud-sync/schedule?provider=${provider}`, {
        method: 'DELETE',
      });
      return response?.ok ?? false;
    } catch (error) {
      console.error('Error deleting sync schedule:', error);
      return false;
    }
  };

  const triggerSync = async (provider: CloudProviderType): Promise<DiffSyncResult | null> => {
    try {
      const response = await authFetch('/api/cloud-sync/sync', {
        method: 'POST',
        body: JSON.stringify({ provider }),
      });
      if (!response?.ok) return null;
      return safeJsonParse<DiffSyncResult>(response);
    } catch (error) {
      console.error('Error triggering sync:', error);
      return null;
    }
  };

  return {
    getStatus,
    getAuthUrl,
    connect,
    disconnect,
    listFiles,
    uploadExport,
    downloadFile,
    getSchedules,
    setSchedule,
    deleteSchedule,
    triggerSync,
  };
};
