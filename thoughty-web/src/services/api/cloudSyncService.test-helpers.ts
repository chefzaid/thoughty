import type { createCloudSyncService } from './cloudSyncService';

type CloudSyncCall = keyof ReturnType<typeof createCloudSyncService>;

/** The message each cloud call falls back to when the API gives no reason. */
const FALLBACK_ERRORS: Record<CloudSyncCall, string> = {
    getStatus: 'Failed to load cloud status',
    getAuthUrl: 'cloudConnectError',
    connect: 'cloudConnectError',
    disconnect: 'cloudDisconnectError',
    listFiles: 'cloudListFilesError',
    uploadExport: 'cloudUploadError',
    downloadFile: 'cloudDownloadError',
    getSchedules: 'Failed to load sync schedules',
    setSchedule: 'cloudScheduleSaveError',
    deleteSchedule: 'cloudScheduleRemoveError',
    triggerSync: 'cloudSyncError',
};

/** What a cloud call resolves to once the API answered with `data`. */
export const cloudOk = <T>(data: T) => ({ data, error: null });

/** What a cloud call resolves to when the API refused it: the given error, or the call's own fallback. */
export const cloudRefused = (call: CloudSyncCall, error = FALLBACK_ERRORS[call]) => ({ data: null, error });
