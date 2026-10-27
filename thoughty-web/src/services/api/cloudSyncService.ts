import type { components } from '../../generated/openapi';
import { requestJson, type ServiceResult } from './base';

export type CloudProviderType = 'google_drive' | 'onedrive' | 'dropbox';

/** A file in the cloud folder, as the API describes it. */
export type CloudFileInfo = components['schemas']['CloudFileInfoDto'];

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

type CloudAuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

/** What a cloud action that returns no data answers once it is done. */
export interface CloudActionResult {
  success: boolean;
}

/**
 * The cloud sync endpoints. Each call resolves to its data, or to the error to show with `t`: the API's
 * coded reason (such as `CLOUD_CONNECTION_EXPIRED`) when it gives one, else the call's fallback key.
 */
export const createCloudSyncService = (authFetch: CloudAuthFetch) => {
  const getStatus = (): Promise<ServiceResult<CloudStatus>> =>
    requestJson(authFetch('/api/cloud-sync/status'), 'Failed to load cloud status');

  const getAuthUrl = async (provider: CloudProviderType, redirectUri: string): Promise<ServiceResult<string>> => {
    const { data, error } = await requestJson<{ url?: string }>(
      authFetch('/api/cloud-sync/auth-url', { method: 'POST', body: JSON.stringify({ provider, redirectUri }) }),
      'cloudConnectError',
    );
    return data?.url ? { data: data.url, error: null } : { data: null, error: error ?? 'cloudConnectError' };
  };

  const connect = (provider: CloudProviderType, code: string, redirectUri: string): Promise<ServiceResult<CloudActionResult>> =>
    requestJson(authFetch('/api/cloud-sync/connect', { method: 'POST', body: JSON.stringify({ provider, code, redirectUri }) }), 'cloudConnectError');

  const disconnect = (provider: CloudProviderType): Promise<ServiceResult<CloudActionResult>> =>
    requestJson(authFetch('/api/cloud-sync/disconnect', { method: 'POST', body: JSON.stringify({ provider }) }), 'cloudDisconnectError');

  const listFiles = (provider: CloudProviderType): Promise<ServiceResult<CloudFileInfo[]>> =>
    requestJson(authFetch(`/api/cloud-sync/files?provider=${provider}`), 'cloudListFilesError');

  const uploadExport = (
    provider: CloudProviderType,
    options?: { diaryId?: number; format?: 'txt' | 'json' | 'md'; includeVisibility?: boolean },
  ): Promise<ServiceResult<CloudFileInfo>> =>
    requestJson(authFetch('/api/cloud-sync/upload', { method: 'POST', body: JSON.stringify({ provider, ...options }) }), 'cloudUploadError');

  const downloadFile = async (provider: CloudProviderType, fileId: string): Promise<ServiceResult<string>> => {
    const { data, error } = await requestJson<{ content?: string }>(
      authFetch('/api/cloud-sync/download', { method: 'POST', body: JSON.stringify({ provider, fileId }) }),
      'cloudDownloadError',
    );
    return data?.content ? { data: data.content, error: null } : { data: null, error: error ?? 'cloudDownloadError' };
  };

  const getSchedules = (): Promise<ServiceResult<SyncSchedules>> =>
    requestJson(authFetch('/api/cloud-sync/schedules'), 'Failed to load sync schedules');

  const setSchedule = (
    provider: CloudProviderType,
    config: { frequency: SyncFrequency; format?: string; diaryId?: number; includeVisibility?: boolean },
  ): Promise<ServiceResult<CloudActionResult>> =>
    requestJson(authFetch('/api/cloud-sync/schedule', { method: 'POST', body: JSON.stringify({ provider, ...config }) }), 'cloudScheduleSaveError');

  const deleteSchedule = (provider: CloudProviderType): Promise<ServiceResult<CloudActionResult>> =>
    requestJson(authFetch(`/api/cloud-sync/schedule?provider=${provider}`, { method: 'DELETE' }), 'cloudScheduleRemoveError');

  const triggerSync = (provider: CloudProviderType): Promise<ServiceResult<DiffSyncResult>> =>
    requestJson(authFetch('/api/cloud-sync/sync', { method: 'POST', body: JSON.stringify({ provider }) }), 'cloudSyncError');

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
