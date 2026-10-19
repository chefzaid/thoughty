/** Guided-memoir state for the mock API; the handlers are in mockApp.routes.memoir.ts. */

/** A short guided-memoir catalogue for browser tests; the real one lives on the server. */
export const MOCK_MEMOIR_CHAPTERS = [
  {
    id: 'childhood',
    title: { en: 'Childhood', fr: 'Enfance' },
    questions: [
      { id: 'childhood-home', text: { en: 'What did the home you grew up in look, sound, and smell like?', fr: 'À quoi ressemblait la maison de votre enfance ?' } },
      { id: 'childhood-play', text: { en: 'What games did you play as a child, and who did you play them with?', fr: 'À quels jeux jouiez-vous enfant, et avec qui ?' } },
    ],
  },
  {
    id: 'work',
    title: { en: 'Work', fr: 'Travail' },
    questions: [
      { id: 'work-path', text: { en: 'How did you come to do the work you did for most of your life?', fr: 'Comment avez-vous trouvé votre métier ?' } },
    ],
  },
];

export const MOCK_MEMOIR_QUESTIONS = MOCK_MEMOIR_CHAPTERS.flatMap((chapter) => chapter.questions.map((question) => ({ ...question, chapter })));

export interface MockMemoirProgram {
  diaryId: number | null;
  status: 'active' | 'paused';
  emailEnabled: boolean;
  emailAvailable: boolean;
  deliveryWeekday: number;
  timeZone: string;
  currentQuestionId: string | null;
  nextDeliveryAt: string;
  startedAt: string;
}

export interface MockMemoirState {
  program: MockMemoirProgram | null;
  answers: Record<string, { entryId: number; answeredAt: string }>;
  lastStartPayload: unknown;
  lastUpdatePayload: unknown;
  lastAnswerPayload: unknown;
}

export function createMockMemoirState(program: Partial<MockMemoirProgram> | null = null): MockMemoirState {
  return {
    program: program && {
      diaryId: 3,
      status: 'active',
      emailEnabled: true,
      emailAvailable: true,
      deliveryWeekday: 0,
      timeZone: 'Europe/Paris',
      currentQuestionId: 'childhood-home',
      nextDeliveryAt: '2026-10-25T08:00:00.000Z',
      startedAt: '2026-10-04T15:20:00.000Z',
      ...program,
    },
    answers: {},
    lastStartPayload: null,
    lastUpdatePayload: null,
    lastAnswerPayload: null,
  };
}
