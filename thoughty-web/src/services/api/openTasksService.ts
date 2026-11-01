import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type OpenTasksPage = components['schemas']['OpenTasksResponseDto'];
export type OpenTask = components['schemas']['OpenTaskDto'];

/** The unticked tasks across the writer's Markdown entries. Errors are translation keys, or the API's coded reason. */
export const createOpenTasksService = (authFetch: AuthFetchFunction) => ({
  fetchPage(page: number, limit: number, diaryId: number | null): Promise<ServiceResult<OpenTasksPage>> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (diaryId !== null) {
      params.set('diaryId', String(diaryId));
    }
    return requestJson(authFetch(`/api/entries/open-tasks?${params}`), 'openTasksLoadError');
  },
});

export type OpenTasksService = ReturnType<typeof createOpenTasksService>;
