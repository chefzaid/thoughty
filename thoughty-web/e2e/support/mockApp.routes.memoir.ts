import {
  createMockMemoirState,
  MOCK_MEMOIR_CHAPTERS,
  MOCK_MEMOIR_QUESTIONS as QUESTIONS,
  MOCK_MEMOIR_THEME_IDS,
  mockMemoirChaptersFor,
  mockSnoozeReturnDay,
  type MockMemoirProgram,
  type MockMemoirState,
} from './mockApp.memoir';
import { mockDiary } from './mockApp.diaries';
import { fulfillJson, type RouteContext } from './mockApp.route-utils';
import { sortEntries } from './mockApp.shared';

/** The questions of the memoir with its chosen themes, in life order. */
function scheduleOf(state: MockMemoirState) {
  return QUESTIONS.filter((question) => mockMemoirChaptersFor(state.program?.themes ?? []).includes(question.chapter));
}

/**
 * The next unanswered question of the memoir after this week's in life order, passing over those set aside (the
 * mock never reaches their day); this week's question still marks the place when its theme was left out.
 */
function nextUnanswered(state: MockMemoirState): string | null {
  const place = QUESTIONS.findIndex((question) => question.id === state.program?.currentQuestionId);
  const schedule = scheduleOf(state);
  const order = (id: string) => QUESTIONS.findIndex((question) => question.id === id);
  const candidates = [...schedule.filter((question) => order(question.id) > place), ...schedule.filter((question) => order(question.id) < place)];
  return candidates.find((candidate) => !state.answers[candidate.id] && !state.snoozed[candidate.id])?.id ?? null;
}

/** Known themes, each once, in life order, as the server keeps them. */
const normalizeThemes = (themes: readonly string[] = []) => MOCK_MEMOIR_THEME_IDS.filter((id) => themes.includes(id));

function overview({ state }: RouteContext) {
  const memoir = state.memoir;
  const schedule = scheduleOf(memoir);
  const answered = schedule.filter((question) => memoir.answers[question.id]).length;
  const words = Object.values(memoir.answers).reduce((total, answer) => {
    const entry = state.entries.find((candidate) => candidate.id === answer.entryId);
    return total + (entry?.content.split('\n\n').slice(1).join(' ').split(/\s+/).filter(Boolean).length ?? 0);
  }, 0);

  return {
    program: memoir.program,
    chapters: mockMemoirChaptersFor(memoir.program?.themes ?? []).map((chapter) => ({
      ...chapter,
      questions: chapter.questions.map((question) => {
        const answer = memoir.answers[question.id] ?? null;
        return { ...question, answer, snoozedUntil: answer ? null : (memoir.snoozed[question.id] ?? null) };
      }),
    })),
    themes: MOCK_MEMOIR_CHAPTERS.filter((chapter) => MOCK_MEMOIR_THEME_IDS.includes(chapter.id))
      .map((chapter) => ({ id: chapter.id, title: chapter.title, questionCount: chapter.questions.length })),
    progress: { answered, total: schedule.length, words, estimatedPages: Math.ceil(words / 250) },
  };
}

export async function handleMemoirRoutes(context: RouteContext): Promise<boolean> {
  const { route, request, pathname, state } = context;
  const memoir = state.memoir;
  const method = request.method();

  // Public: the question pages read it without an account
  if (pathname === '/api/memoir/questions' && method === 'GET') {
    await fulfillJson(route, {
      chapters: MOCK_MEMOIR_CHAPTERS.map((chapter) => ({ ...chapter, theme: MOCK_MEMOIR_THEME_IDS.includes(chapter.id) })),
    });
    return true;
  }

  if (pathname === '/api/memoir' && method === 'GET') {
    await fulfillJson(route, overview(context));
    return true;
  }

  if (pathname === '/api/memoir' && method === 'POST') {
    const payload = request.postDataJSON() as {
      diaryId?: number;
      diaryName?: string;
      emailEnabled: boolean;
      deliveryWeekday: number;
      timeZone: string;
      themes?: string[];
    };
    memoir.lastStartPayload = payload;
    let diaryId = payload.diaryId ?? null;
    if (!diaryId) {
      diaryId = Math.max(...state.diaries.map((diary) => diary.id)) + 1;
      state.diaries.push(mockDiary({ id: diaryId, name: payload.diaryName ?? 'My memoir', icon: '📖', color: '#B45309', position: state.diaries.length }));
    }
    memoir.program = {
      ...createMockMemoirState({}).program!,
      diaryId,
      emailEnabled: payload.emailEnabled,
      deliveryWeekday: payload.deliveryWeekday,
      timeZone: payload.timeZone,
      themes: normalizeThemes(payload.themes),
      currentQuestionId: QUESTIONS[0].id,
    };
    await fulfillJson(route, overview(context), { status: 201 });
    return true;
  }

  if (pathname === '/api/memoir' && method === 'PATCH' && memoir.program) {
    const payload = request.postDataJSON() as Partial<MockMemoirProgram>;
    memoir.lastUpdatePayload = payload;
    memoir.program = { ...memoir.program, ...payload, themes: normalizeThemes(payload.themes ?? memoir.program.themes) };
    // This week's question leaves with its theme, or a new theme follows a finished memoir: the next one comes at once
    const current = memoir.program.currentQuestionId;
    if (payload.themes && !scheduleOf(memoir).some((question) => question.id === current)) {
      memoir.program.currentQuestionId = nextUnanswered(memoir);
    }
    await fulfillJson(route, overview(context));
    return true;
  }

  if (pathname === '/api/memoir' && method === 'DELETE') {
    memoir.program = null;
    memoir.snoozed = {};
    await fulfillJson(route, { success: true });
    return true;
  }

  if (pathname === '/api/memoir/skip' && memoir.program) {
    memoir.program.currentQuestionId = nextUnanswered(memoir);
    await fulfillJson(route, overview(context));
    return true;
  }

  if (pathname === '/api/memoir/snooze' && memoir.program) {
    const questionId = memoir.program.currentQuestionId;
    if (!questionId || memoir.answers[questionId]) {
      await fulfillJson(route, { statusCode: 409, code: 'MEMOIR_NO_OPEN_QUESTION', message: 'This week has no unanswered question to set aside' }, { status: 409 });
      return true;
    }
    memoir.snoozed[questionId] = mockSnoozeReturnDay(memoir.program);
    memoir.program.currentQuestionId = nextUnanswered(memoir);
    await fulfillJson(route, overview(context));
    return true;
  }

  if (pathname === '/api/memoir/answers' && method === 'POST' && memoir.program) {
    const payload = request.postDataJSON() as { questionId: string; text: string; attachmentIds?: number[]; eraId?: number };
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
        // The era the memory belongs to is a second tag, as `MemoirAnswersService` adds it
        tags: [question.chapter.title.en, ...state.lifeEras.filter((era) => era.id === payload.eraId).map((era) => era.name)],
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
