import {
  buildStats,
  sortEntries,
  unique,
  type MockAppState,
} from './mockApp.shared';
import { fulfillJson, sortStrings, toEntryResponse, type RouteContext } from './mockApp.route-utils';

function getAiFixPrefix(mode?: string): string {
  if (mode === 'rewrite') {
    return 'Rewritten';
  }
  if (mode === 'polish') {
    return 'Polished';
  }
  return 'Corrected';
}

async function handleStatsAndAiRoutes({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/stats') {
    const diaryId = searchParams.get('diaryId');
    const filteredEntries = diaryId
      ? state.entries.filter((entry) => String(entry.diaryId ?? 1) === diaryId)
      : state.entries;

    await fulfillJson(route, buildStats(filteredEntries));
    return true;
  }

  if (pathname === '/api/ai/suggest-tags') {
    state.lastAiSuggestionPayload = request.postDataJSON();
    await fulfillJson(route, { tags: ['focus', 'reflection', 'writing'] });
    return true;
  }

  if (pathname === '/api/ai/fix-writing') {
    const payload = request.postDataJSON() as { content: string; mode?: string };
    state.lastAiFixPayload = payload;
    await fulfillJson(route, { content: `${getAiFixPrefix(payload.mode)}: ${payload.content}` });
    return true;
  }

  if (pathname === '/api/ai/chat') {
    state.lastAiChatPayload = request.postDataJSON();
    await fulfillJson(route, { reply: 'This entry reflects a thoughtful focus on the day.' });
    return true;
  }

  const aiHistoryMatch = /^\/api\/ai\/history\/(\d+)$/.exec(pathname);
  if (aiHistoryMatch) {
    await fulfillJson(route, {
      messages: [{ role: 'assistant', content: 'Previously saved reflection prompt.' }],
    });
    return true;
  }

  return false;
}

async function handleDiaryRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/diaries') {
    if (request.method() === 'GET') {
      await fulfillJson(route, state.diaries);
      return true;
    }

    if (request.method() === 'POST') {
      const payload = request.postDataJSON() as {
        name: string;
        icon?: string;
        color?: string | null;
        visibility?: 'public' | 'private';
      };
      const newDiary = {
        id: Math.max(0, ...state.diaries.map((diary) => diary.id)) + 1,
        name: payload.name,
        icon: payload.icon || '📓',
        color: payload.color || null,
        visibility: payload.visibility || 'private',
        is_default: false,
      };
      state.diaries.push(newDiary);
      await fulfillJson(route, { success: true, diary: newDiary }, { status: 201 });
      return true;
    }
  }

  const diaryMatch = /^\/api\/diaries\/(\d+)$/.exec(pathname);
  if (diaryMatch && request.method() === 'PUT') {
    const diaryId = Number(diaryMatch[1]);
    const payload = request.postDataJSON() as {
      name: string;
      icon?: string;
      color?: string | null;
      visibility?: 'public' | 'private';
    };
    state.diaries = state.diaries.map((diary) =>
      diary.id === diaryId ? { ...diary, ...payload } : diary,
    );
    await fulfillJson(route, { success: true });
    return true;
  }

  if (diaryMatch && request.method() === 'DELETE') {
    const diaryId = Number(diaryMatch[1]);
    const defaultDiary = state.diaries.find((diary) => diary.is_default) ?? state.diaries[0];
    state.diaries = state.diaries.filter((diary) => diary.id !== diaryId || diary.is_default);
    state.entries = state.entries.map((entry) =>
      (entry.diaryId ?? 1) === diaryId ? { ...entry, diaryId: defaultDiary?.id ?? 1 } : entry,
    );
    await fulfillJson(route, { success: true });
    return true;
  }

  const defaultDiaryMatch = /^\/api\/diaries\/(\d+)\/default$/.exec(pathname);
  if (defaultDiaryMatch && request.method() === 'PATCH') {
    const diaryId = Number(defaultDiaryMatch[1]);
    state.diaries = state.diaries.map((diary) => ({ ...diary, is_default: diary.id === diaryId }));
    await fulfillJson(route, { success: true });
    return true;
  }

  if (pathname === '/api/diaries/reorder' && request.method() === 'PATCH') {
    const payload = request.postDataJSON() as { orderedIds: number[] };
    const diaryById = new Map(state.diaries.map((diary) => [diary.id, diary]));
    state.diaries = payload.orderedIds
      .map((id) => diaryById.get(id))
      .filter((diary): diary is MockAppState['diaries'][number] => Boolean(diary));
    await fulfillJson(route, { success: true });
    return true;
  }

  return false;
}

async function handleEntryReferenceRoutes({ route, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/entries/dates') {
    await fulfillJson(route, { dates: sortStrings(unique(state.entries.map((entry) => entry.date))) });
    return true;
  }

  if (pathname === '/api/entries/first') {
    const years = unique(state.entries.map((entry) => Number(entry.date.slice(0, 4)))).sort(
      (left, right) => left - right,
    );
    const months = sortStrings(unique(state.entries.map((entry) => entry.date.slice(5, 7))));

    await fulfillJson(route, { years, months });
    return true;
  }

  if (pathname === '/api/entries/by-date') {
    const limit = Number(searchParams.get('limit') || '10');
    const entryId = Number(searchParams.get('id') || '0');
    const date = searchParams.get('date');
    const entryIndex = Number(searchParams.get('index') || '0');
    const sortedEntries = sortEntries(state.entries);
    const matchedEntry =
      entryId > 0
        ? sortedEntries.find((entry) => entry.id === entryId)
        : sortedEntries.find((entry) => entry.date === date && entry.index === entryIndex);

    if (!matchedEntry) {
      await fulfillJson(route, { found: false });
      return true;
    }

    const entryPosition = sortedEntries.findIndex((entry) => entry.id === matchedEntry.id);
    const page = entryPosition >= 0 ? Math.floor(entryPosition / Math.max(limit, 1)) + 1 : 1;

    await fulfillJson(route, { found: true, page, entryId: matchedEntry.id });
    return true;
  }

  if (pathname === '/api/entries/highlights' || pathname === '/api/highlights') {
    const scopedEntries = searchParams.get('diaryId')
      ? state.entries.filter((entry) => String(entry.diaryId ?? 1) === searchParams.get('diaryId'))
      : state.entries;
    const sorted = sortEntries(scopedEntries);
    const randomEntry = sorted[0] ?? null;
    const onThisDayEntry = sorted[1] ?? sorted[0] ?? null;

    await fulfillJson(route, {
      randomEntry: randomEntry ? toEntryResponse(randomEntry, state) : null,
      onThisDay: onThisDayEntry ? { '1': [toEntryResponse(onThisDayEntry, state)] } : {},
    });
    return true;
  }

  return false;
}

export async function handleReferenceRoutes(context: RouteContext): Promise<boolean> {
  if (await handleStatsAndAiRoutes(context)) {
    return true;
  }

  if (await handleDiaryRoutes(context)) {
    return true;
  }

  if (await handleEntryReferenceRoutes(context)) {
    return true;
  }

  return false;
}