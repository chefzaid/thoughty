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
  /** Questions set aside with "Not this week": question ID → the writer's day it comes back. */
  snoozed: Record<string, string>;
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
    snoozed: {},
    lastStartPayload: null,
    lastUpdatePayload: null,
    lastAnswerPayload: null,
  };
}

/**
 * The day "Not this week" brings a question back, as `memoirSnoozeReturnDay` on the server works it out:
 * the local day of the next delivery in the memoir's zone, plus three weeks.
 */
export function mockSnoozeReturnDay(program: MockMemoirProgram): string {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: program.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(program.nextDeliveryAt));
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + 21)).toISOString().slice(0, 10);
}
