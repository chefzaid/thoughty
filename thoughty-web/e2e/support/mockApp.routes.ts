import type { Page } from '@playwright/test';
import {
  buildExportBody,
  DEFAULT_FORMAT_CONFIG,
  parseImportedEntries,
  sortEntries,
  type MockAppState,
} from './mockApp.shared';
import { fulfillJson, type RouteContext } from './mockApp.route-utils';
import { handleCloudSyncRoutes } from './mockApp.routes.cloud-sync';
import { handleEntriesRoutes } from './mockApp.routes.entries';
import { handleReferenceRoutes } from './mockApp.routes.reference';

async function handleAuthRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/auth/register') {
    const payload = request.postDataJSON() as {
      email?: string;
      username?: string;
    };
    state.lastRegisterPayload = payload;
    state.authenticated = true;
    state.user = {
      id: 1,
      username: payload.username || 'NewUser',
      email: payload.email || 'new@example.com',
      fullName: payload.username || 'NewUser',
    };

    await fulfillJson(route, {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      user: state.user,
    });
    return true;
  }

  if (pathname === '/api/auth/login') {
    state.lastLoginPayload = request.postDataJSON();
    state.authenticated = true;

    await fulfillJson(route, {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      user: state.user,
    });
    return true;
  }

  if (pathname === '/api/auth/me') {
    if (!state.authenticated) {
      await fulfillJson(route, { error: 'Unauthorized' }, { status: 401 });
      return true;
    }

    await fulfillJson(route, state.user);
    return true;
  }

  return false;
}

async function handleConfigRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/config') {
    if (request.method() === 'POST') {
      state.config = {
        ...state.config,
        ...(request.postDataJSON() as Record<string, unknown>),
      };
    }

    await fulfillJson(route, state.config);
    return true;
  }

  if (pathname === '/api/config/profile-stats') {
    const years = state.entries.map((entry) => Number(entry.date.slice(0, 4)));

    await fulfillJson(route, {
      totalEntries: state.entries.length,
      uniqueTags: unique(state.entries.flatMap((entry) => entry.tags)).length,
      firstEntryYear: years.length > 0 ? Math.min(...years) : 2024,
    });
    return true;
  }

  return false;
}

async function handleIoRoutes({ route, request, url, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/io/format') {
    if (request.method() === 'POST') {
      state.lastFormatPayload = request.postDataJSON();
    }

    await fulfillJson(route, state.lastFormatPayload || DEFAULT_FORMAT_CONFIG);
    return true;
  }

  if (pathname === '/api/io/preview') {
    const payload = request.postDataJSON() as { content: string };
    state.lastPreviewPayload = payload;
    const importedEntries = parseImportedEntries(payload.content);

    await fulfillJson(route, {
      totalCount: importedEntries.length,
      duplicateCount: 0,
    });
    return true;
  }

  if (pathname === '/api/io/import') {
    const payload = request.postDataJSON() as { content: string; diaryId?: number | null };
    state.lastImportPayload = payload;
    const importedEntries = parseImportedEntries(payload.content);

    for (const imported of importedEntries) {
      const sameDayEntries = state.entries.filter((entry) => entry.date === imported.date);
      state.entries.push({
        id: state.nextEntryId++,
        date: imported.date,
        index: sameDayEntries.length + 1,
        content: imported.content,
        tags: imported.tags,
        visibility: imported.visibility || 'private',
        format: imported.format || 'plain',
        diaryId: payload.diaryId ?? 1,
      });
    }

    state.entries = sortEntries(state.entries);

    await fulfillJson(route, {
      importedCount: importedEntries.length,
      skippedCount: 0,
      totalProcessed: importedEntries.length,
    });
    return true;
  }

  if (pathname === '/api/io/export') {
    state.lastExportRequestUrl = url;
    const { body, contentType, extension } = buildExportBody(
      state.entries,
      searchParams.get('format'),
    );

    await route.fulfill({
      status: 200,
      contentType,
      headers: {
        'Content-Disposition': `attachment; filename="thoughty_export_2026-04-18.${extension}"`,
      },
      body,
    });
    return true;
  }

  return false;
}

export async function registerMockAppRoutes(page: Page, state: MockAppState) {
  await page.route('http://localhost:5173/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const context: RouteContext = {
      route,
      request,
      url,
      pathname: url.pathname,
      searchParams: url.searchParams,
      state,
    };

    if (await handleAuthRoutes(context)) {
      return;
    }
    if (await handleConfigRoutes(context)) {
      return;
    }
    if (await handleReferenceRoutes(context)) {
      return;
    }
    if (await handleIoRoutes(context)) {
      return;
    }
    if (await handleCloudSyncRoutes(context)) {
      return;
    }
    if (await handleEntriesRoutes(context)) {
      return;
    }

    await fulfillJson(route, { success: true });
  });
}