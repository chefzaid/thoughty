import type { Request, Route } from '@playwright/test';

import type { MockAppState, MockCloudFile, MockCloudProvider, MockCloudSchedule } from './mockApp.shared';
import { fulfillJson } from './mockApp.route-utils';

type CloudSyncRouteContext = {
  route: Route;
  request: Request;
  url: URL;
  pathname: string;
  searchParams: URLSearchParams;
  state: MockAppState;
};

type CloudSyncHandlerContext = {
  route: Route;
  request: Request;
  pathname: string;
  searchParams: URLSearchParams;
  state: MockAppState;
};

function toCloudFileResponse(file: MockCloudFile) {
  return {
    id: file.id,
    name: file.name,
    size: file.size,
    modifiedAt: file.modifiedAt,
  };
}

function nextSyncAtFor(frequency?: MockCloudSchedule['frequency']): string {
  switch (frequency) {
    case 'every_6h':
      return '2026-04-18T16:00:00.000Z';
    case 'every_12h':
      return '2026-04-18T22:00:00.000Z';
    case 'weekly':
      return '2026-04-25T10:00:00.000Z';
    case 'daily':
    default:
      return '2026-04-19T10:00:00.000Z';
  }
}

export async function handleCloudSyncRoutes(context: CloudSyncRouteContext): Promise<boolean> {
  if (await handleCloudSyncReadRoutes(context)) {
    return true;
  }

  if (await handleCloudSyncWriteRoutes(context)) {
    return true;
  }

  return false;
}

async function handleCloudSyncReadRoutes({ route, request, pathname, searchParams, state }: CloudSyncHandlerContext): Promise<boolean> {
  if (pathname === '/api/cloud-sync/status') {
    await fulfillJson(route, state.cloudStatus);
    return true;
  }

  if (pathname === '/api/cloud-sync/schedules') {
    await fulfillJson(route, state.cloudSchedules);
    return true;
  }

  if (pathname === '/api/cloud-sync/files') {
    state.lastCloudFilesRequestUrl = new URL(request.url());
    const provider = searchParams.get('provider');
    const files = provider
      ? state.cloudFiles.filter((file) => file.provider === provider)
      : state.cloudFiles;
    await fulfillJson(route, files.map(toCloudFileResponse));
    return true;
  }

  if (pathname === '/api/cloud-sync/download' && request.method() === 'POST') {
    const payload = request.postDataJSON() as { provider: MockCloudProvider; fileId: string };
    state.lastCloudDownloadPayload = payload;
    const file = state.cloudFiles.find(
      (candidate) => candidate.provider === payload.provider && candidate.id === payload.fileId,
    );

    await fulfillJson(route, {
      content: file?.content || JSON.stringify({ entries: [] }),
    });
    return true;
  }

  return false;
}

async function handleCloudSyncWriteRoutes({ route, request, pathname, searchParams, state }: CloudSyncHandlerContext): Promise<boolean> {
  if (pathname === '/api/cloud-sync/upload' && request.method() === 'POST') {
    const payload = request.postDataJSON() as {
      provider: MockCloudProvider;
      diaryId?: number;
      format?: 'txt' | 'json' | 'md';
      includeVisibility?: boolean;
    };
    state.lastCloudUploadPayload = payload;

    const uploadedFile: MockCloudFile = {
      id: `upload-${state.cloudFiles.length + 1}`,
      provider: payload.provider,
      name: `thoughty-${payload.provider}.${payload.format || 'txt'}`,
      size: 1024,
      modifiedAt: new Date().toISOString(),
    };
    state.cloudFiles = [uploadedFile, ...state.cloudFiles.filter((file) => file.id !== uploadedFile.id)];

    await fulfillJson(route, toCloudFileResponse(uploadedFile));
    return true;
  }

  if (pathname === '/api/cloud-sync/schedule' && request.method() === 'POST') {
    const payload = request.postDataJSON() as {
      provider: MockCloudProvider;
      frequency: MockCloudSchedule['frequency'];
      format?: 'txt' | 'json' | 'md';
      diaryId?: number;
      includeVisibility?: boolean;
    };
    state.lastCloudSchedulePayload = payload;
    state.cloudSchedules = {
      ...state.cloudSchedules,
      [payload.provider]: {
        enabled: true,
        frequency: payload.frequency,
        format: payload.format,
        diaryId: payload.diaryId,
        includeVisibility: payload.includeVisibility,
        lastSyncAt: state.cloudSchedules[payload.provider]?.lastSyncAt,
        nextSyncAt: nextSyncAtFor(payload.frequency),
      },
    };
    await fulfillJson(route, { success: true });
    return true;
  }

  if (pathname === '/api/cloud-sync/schedule' && request.method() === 'DELETE') {
    const provider = searchParams.get('provider');
    state.lastCloudDeleteScheduleProvider = provider;

    if (provider === 'google_drive' || provider === 'onedrive' || provider === 'dropbox') {
      const nextSchedules = { ...state.cloudSchedules };
      delete nextSchedules[provider];
      state.cloudSchedules = nextSchedules;
    }

    await fulfillJson(route, { success: true });
    return true;
  }

  if (pathname === '/api/cloud-sync/sync' && request.method() === 'POST') {
    const payload = request.postDataJSON() as { provider: MockCloudProvider };
    state.lastCloudSyncPayload = payload;

    const currentSchedule = state.cloudSchedules[payload.provider];
    if (currentSchedule) {
      state.cloudSchedules = {
        ...state.cloudSchedules,
        [payload.provider]: {
          ...currentSchedule,
          lastSyncAt: '2026-04-18T12:00:00.000Z',
          nextSyncAt: nextSyncAtFor(currentSchedule.frequency),
        },
      };
    }

    await fulfillJson(route, { success: true, synced: false, message: 'No changes detected' });
    return true;
  }

  return false;
}