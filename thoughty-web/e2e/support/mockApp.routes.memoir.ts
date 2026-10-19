import {
  createMockMemoirState,
  MOCK_MEMOIR_CHAPTERS,
  MOCK_MEMOIR_QUESTIONS as QUESTIONS,
  type MockMemoirProgram,
  type MockMemoirState,
} from './mockApp.memoir';
import { fulfillJson, type RouteContext } from './mockApp.route-utils';
import { sortEntries } from './mockApp.shared';

function nextUnanswered(state: MockMemoirState): string | null {
  const start = QUESTIONS.findIndex((question) => question.id === state.program?.currentQuestionId);
  for (let offset = 1; offset <= QUESTIONS.length; offset++) {
    const candidate = QUESTIONS[(start + offset) % QUESTIONS.length];
    if (!state.answers[candidate.id]) return candidate.id;
  }
  return null;
}

function overview({ state }: RouteContext) {
  const memoir = state.memoir;
  const answered = Object.keys(memoir.answers).length;
  const words = Object.values(memoir.answers).reduce((total, answer) => {
    const entry = state.entries.find((candidate) => candidate.id === answer.entryId);
    return total + (entry?.content.split('\n\n').slice(1).join(' ').split(/\s+/).filter(Boolean).length ?? 0);
  }, 0);

  return {
    program: memoir.program,
    chapters: MOCK_MEMOIR_CHAPTERS.map((chapter) => ({
      ...chapter,
      questions: chapter.questions.map((question) => ({ ...question, answer: memoir.answers[question.id] ?? null })),
    })),
    progress: { answered, total: QUESTIONS.length, words, estimatedPages: Math.ceil(words / 250) },
  };
}

export async function handleMemoirRoutes(context: RouteContext): Promise<boolean> {
  const { route, request, pathname, state } = context;
  const memoir = state.memoir;
  const method = request.method();

  if (pathname === '/api/memoir' && method === 'GET') {
    await fulfillJson(route, overview(context));
    return true;
  }

  if (pathname === '/api/memoir' && method === 'POST') {
    const payload = request.postDataJSON() as { diaryId?: number; diaryName?: string; emailEnabled: boolean; deliveryWeekday: number; timeZone: string };
    memoir.lastStartPayload = payload;
    let diaryId = payload.diaryId ?? null;
    if (!diaryId) {
      diaryId = Math.max(...state.diaries.map((diary) => diary.id)) + 1;
      state.diaries.push({ id: diaryId, name: payload.diaryName ?? 'My memoir', icon: '📖', is_default: false, visibility: 'private', color: '#B45309' });
    }
    memoir.program = {
      ...createMockMemoirState({}).program!,
      diaryId,
      emailEnabled: payload.emailEnabled,
      deliveryWeekday: payload.deliveryWeekday,
      timeZone: payload.timeZone,
      currentQuestionId: QUESTIONS[0].id,
    };
    await fulfillJson(route, overview(context), { status: 201 });
    return true;
  }

  if (pathname === '/api/memoir' && method === 'PATCH' && memoir.program) {
    const payload = request.postDataJSON() as Partial<MockMemoirProgram>;
    memoir.lastUpdatePayload = payload;
    memoir.program = { ...memoir.program, ...payload };
    await fulfillJson(route, overview(context));
    return true;
  }

  if (pathname === '/api/memoir' && method === 'DELETE') {
    memoir.program = null;
    await fulfillJson(route, { success: true });
    return true;
  }

  if (pathname === '/api/memoir/skip' && memoir.program) {
    memoir.program.currentQuestionId = nextUnanswered(memoir);
    await fulfillJson(route, overview(context));
    return true;
  }

  if (pathname === '/api/memoir/answers' && method === 'POST' && memoir.program) {
    const payload = request.postDataJSON() as { questionId: string; text: string; attachmentIds?: number[] };
    memoir.lastAnswerPayload = payload;
    const question = QUESTIONS.find((candidate) => candidate.id === payload.questionId);
    if (!question || memoir.answers[question.id]) {
      await fulfillJson(route, { message: 'This question already has an answer' }, { status: 409 });
      return true;
    }
    const entryId = state.nextEntryId++;
    state.entries = sortEntries([
      ...state.entries,
      {
        id: entryId,
        date: '2026-10-19',
        index: 1,
        content: payload.text ? `### ${question.text.en}\n\n${payload.text}` : `### ${question.text.en}`,
        tags: [question.chapter.title.en],
        visibility: 'private',
        format: 'markdown',
        diaryId: memoir.program.diaryId,
      },
    ]);
    memoir.answers[question.id] = { entryId, answeredAt: '2026-10-19T09:00:00.000Z' };
    await fulfillJson(route, { questionId: question.id, entryId }, { status: 201 });
    return true;
  }

  return false;
}
