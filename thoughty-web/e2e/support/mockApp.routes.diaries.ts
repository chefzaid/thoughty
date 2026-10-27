import type { components } from '../../src/generated/openapi';
import { mockDiary, type MockDiary } from './mockApp.diaries';
import { fulfillApiError, fulfillJson, type RouteContext } from './mockApp.route-utils';

type Schemas = components['schemas'];
const SUCCESS: Schemas['SuccessResponseDto'] = { success: true };

/** Whether the writer has another diary of that name, compared as the API's unique index compares. */
const nameTaken = (diaries: MockDiary[], name: string, exceptId?: number): boolean =>
  diaries.some((diary) => diary.id !== exceptId && diary.name.trim().toLowerCase() === name.trim().toLowerCase());

const refuseTakenName = (route: RouteContext['route']) =>
  fulfillApiError(route, 409, 'DIARY_NAME_TAKEN', 'A diary with this name already exists');

/** /api/diaries, answering exactly what DiariesController returns. */
export async function handleDiaryRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/diaries') {
    if (request.method() === 'GET') {
      await fulfillJson(route, state.diaries satisfies MockDiary[]);
      return true;
    }

    if (request.method() === 'POST') {
      const payload = request.postDataJSON() as Schemas['CreateDiaryDto'];
      if (nameTaken(state.diaries, payload.name)) {
        await refuseTakenName(route);
        return true;
      }
      const newDiary = mockDiary({
        id: Math.max(0, ...state.diaries.map((diary) => diary.id)) + 1,
        name: payload.name.trim(),
        icon: payload.icon || '📓',
        color: payload.color || null,
        visibility: payload.visibility || 'private',
        position: state.diaries.length,
        goalType: payload.goalType ?? null,
        goalTarget: payload.goalTarget ?? null,
      });
      state.diaries.push(newDiary);
      await fulfillJson(route, newDiary, { status: 201 });
      return true;
    }
  }

  if (pathname === '/api/diaries/reorder' && request.method() === 'PATCH') {
    const payload = request.postDataJSON() as Schemas['ReorderDiariesDto'];
    const diaryById = new Map(state.diaries.map((diary) => [diary.id, diary]));
    state.diaries = payload.orderedIds
      .map((id) => diaryById.get(id))
      .filter((diary): diary is MockDiary => Boolean(diary))
      .map((diary, position) => ({ ...diary, position }));
    await fulfillJson(route, SUCCESS);
    return true;
  }

  const diaryMatch = /^\/api\/diaries\/(\d+)(\/default)?$/.exec(pathname);
  const diary = diaryMatch ? state.diaries.find((candidate) => candidate.id === Number(diaryMatch[1])) : undefined;
  if (!diaryMatch) {
    return false;
  }
  if (!diary) {
    await fulfillApiError(route, 404, 'DIARY_NOT_FOUND', 'Diary not found');
    return true;
  }

  if (diaryMatch[2] && request.method() === 'PATCH') {
    state.diaries = state.diaries.map((candidate) => ({ ...candidate, isDefault: candidate.id === diary.id }));
    await fulfillJson(route, { ...diary, isDefault: true } satisfies MockDiary);
    return true;
  }

  if (request.method() === 'PUT') {
    const payload = request.postDataJSON() as Schemas['UpdateDiaryDto'];
    if (nameTaken(state.diaries, payload.name, diary.id)) {
      await refuseTakenName(route);
      return true;
    }
    const updated: MockDiary = {
      ...diary,
      name: payload.name.trim(),
      icon: payload.icon || '📓',
      color: payload.color ?? diary.color,
      visibility: payload.visibility ?? diary.visibility,
      ...(payload.goalType === undefined ? {} : { goalType: payload.goalType, goalTarget: payload.goalTarget ?? null }),
    };
    state.diaries = state.diaries.map((candidate) => (candidate.id === diary.id ? updated : candidate));
    await fulfillJson(route, updated);
    return true;
  }

  if (request.method() === 'DELETE') {
    if (diary.isDefault) {
      await fulfillApiError(route, 400, 'DIARY_DEFAULT_NOT_DELETABLE', 'Cannot delete the default diary');
      return true;
    }
    const defaultDiaryId = state.diaries.find((candidate) => candidate.isDefault)?.id ?? 1;
    state.diaries = state.diaries.filter((candidate) => candidate.id !== diary.id);
    // Entries, and those in the recycle bin, move to the default diary as the API moves them
    state.entries = state.entries.map((entry) =>
      (entry.diaryId ?? 1) === diary.id ? { ...entry, diaryId: defaultDiaryId } : entry,
    );
    state.trash = state.trash.map((entry) =>
      (entry.diaryId ?? 1) === diary.id ? { ...entry, diaryId: defaultDiaryId } : entry,
    );
    await fulfillJson(route, SUCCESS);
    return true;
  }

  return false;
}
