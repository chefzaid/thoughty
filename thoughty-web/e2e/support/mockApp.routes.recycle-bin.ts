import { sortEntries, type MockAppState, type MockTrashedEntry } from './mockApp.shared';
import { fulfillApiError, fulfillJson, type RouteContext } from './mockApp.route-utils';
import { isMockSealed } from './mockApp.routes.time-capsules';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function toTrashedEntryResponse(entry: MockTrashedEntry, state: MockAppState) {
  const diary = state.diaries.find((candidate) => candidate.id === (entry.diaryId ?? 1));
  return {
    id: entry.id,
    date: entry.date,
    title: isMockSealed(entry) ? null : (entry.title ?? null),
    timeOfDay: entry.time_of_day ?? null,
    content: isMockSealed(entry) ? '' : entry.content,
    format: entry.format ?? 'plain',
    tags: isMockSealed(entry) ? [] : entry.tags,
    diaryId: diary ? diary.id : null,
    diaryName: diary?.name ?? null,
    diaryIcon: diary?.icon ?? null,
    diaryColor: diary?.color ?? null,
    attachmentCount: entry.attachments?.length ?? 0,
    sealedUntil: isMockSealed(entry) ? entry.capsule!.openAt : null,
    deletedAt: entry.deletedAt,
    purgeAt: new Date(new Date(entry.deletedAt).getTime() + RETENTION_MS).toISOString(),
  };
}

/**
 * Puts entries back at the end of their day, or with `inPlace` where they were in it (the entries after it move
 * down one), as the API does; entries of a missing diary go to the default one.
 */
function restore(state: MockAppState, ids: Set<number> | null, inPlace = false) {
  const restoring = state.trash
    .filter((entry) => !ids || ids.has(entry.id))
    .sort((left, right) => left.date.localeCompare(right.date) || left.index - right.index);
  const defaultDiaryId = state.diaries.find((diary) => diary.isDefault)?.id ?? 1;
  let movedToDefaultCount = 0;

  for (const { deletedAt: _deletedAt, ...entry } of restoring) {
    const hasDiary = state.diaries.some((diary) => diary.id === (entry.diaryId ?? 1));
    if (!hasDiary) {
      movedToDefaultCount += 1;
    }
    const sameDay = state.entries.filter((candidate) => candidate.date === entry.date);
    const index = inPlace ? Math.min(Math.max(entry.index, 1), sameDay.length + 1) : sameDay.length + 1;
    state.entries = state.entries.map((candidate) => (
      candidate.date === entry.date && candidate.index >= index ? { ...candidate, index: candidate.index + 1 } : candidate
    ));
    state.entries.push({ ...entry, index, diaryId: hasDiary ? entry.diaryId : defaultDiaryId });
  }

  const restoredIds = new Set(restoring.map((entry) => entry.id));
  state.trash = state.trash.filter((entry) => !restoredIds.has(entry.id));
  state.entries = sortEntries(state.entries);
  return { success: true, restoredCount: restoring.length, movedToDefaultCount };
}

export async function handleRecycleBinRoutes({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/recycle-bin' && request.method() === 'GET') {
    const page = Number(searchParams.get('page') || '1');
    const limit = Number(searchParams.get('limit') || '20');
    const ordered = [...state.trash].sort((left, right) => right.deletedAt.localeCompare(left.deletedAt) || right.id - left.id);
    await fulfillJson(route, {
      entries: ordered.slice((page - 1) * limit, page * limit).map((entry) => toTrashedEntryResponse(entry, state)),
      total: ordered.length,
      page,
      totalPages: Math.max(1, Math.ceil(ordered.length / limit)),
      retentionDays: 30,
    });
    return true;
  }

  if (pathname === '/api/recycle-bin' && request.method() === 'DELETE') {
    const deletedCount = state.trash.length;
    state.trash = [];
    await fulfillJson(route, { success: true, deletedCount });
    return true;
  }

  if (pathname === '/api/recycle-bin/restore-all' && request.method() === 'POST') {
    await fulfillJson(route, restore(state, null));
    return true;
  }

  if ((pathname === '/api/recycle-bin/restore' || pathname === '/api/recycle-bin/delete') && request.method() === 'POST') {
    const body = request.postDataJSON() as { ids: number[]; inPlace?: boolean };
    const ids = new Set(body.ids);
    if (!state.trash.some((entry) => ids.has(entry.id))) {
      await fulfillApiError(route, 404, 'RECYCLE_BIN_ENTRIES_NOT_FOUND', 'No matching entries in the recycle bin');
      return true;
    }

    if (pathname.endsWith('/restore')) {
      await fulfillJson(route, restore(state, ids, body.inPlace === true));
    } else {
      const before = state.trash.length;
      state.trash = state.trash.filter((entry) => !ids.has(entry.id));
      await fulfillJson(route, { success: true, deletedCount: before - state.trash.length });
    }
    return true;
  }

  return false;
}
