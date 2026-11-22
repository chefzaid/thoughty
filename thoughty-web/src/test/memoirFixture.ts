import type { MemoirOverview, MemoirProgram } from '../services/api';

/** Two chapters of three questions, one of them answered. */
export const memoirChapters: MemoirOverview['chapters'] = [
  {
    id: 'childhood',
    title: { en: 'Childhood', fr: 'Enfance' },
    questions: [
      { id: 'childhood-home', text: { en: 'What was home like?', fr: 'Comment était la maison ?' }, answer: null, snoozedUntil: null },
      {
        id: 'childhood-play',
        text: { en: 'What games did you play?', fr: 'À quoi jouiez-vous ?' },
        answer: { entryId: 81, answeredAt: '2026-10-12T09:00:00.000Z' },
        snoozedUntil: null,
      },
    ],
  },
  {
    id: 'work',
    title: { en: 'Work', fr: 'Travail' },
    questions: [{ id: 'work-path', text: { en: 'How did you find your work?', fr: 'Comment avez-vous trouvé votre métier ?' }, answer: null, snoozedUntil: null }],
  },
];

/** Two of the themed chapters a writer can add. */
export const memoirThemes: MemoirOverview['themes'] = [
  { id: 'parenthood', title: { en: 'Parenthood', fr: 'Être parent' }, questionCount: 7 },
  { id: 'migration', title: { en: 'Migration', fr: 'Migration' }, questionCount: 1 },
];

/** An active memoir asking `childhood-home` this week, with Sunday deliveries in Paris. */
export const memoirProgram: MemoirProgram = {
  diaryId: 6,
  status: 'active',
  emailEnabled: true,
  emailAvailable: true,
  deliveryWeekday: 0,
  timeZone: 'Europe/Paris',
  themes: [],
  currentQuestionId: 'childhood-home',
  nextDeliveryAt: '2026-10-25T08:00:00.000Z',
  startedAt: '2026-10-04T15:20:00.000Z',
};

/** The chapters with the given questions answered (entry IDs) and set aside (return days). */
export function memoirChaptersWith(
  answered: Record<string, number> = {},
  setAside: Record<string, string> = {},
): MemoirOverview['chapters'] {
  return memoirChapters.map((chapter) => ({
    ...chapter,
    questions: chapter.questions.map((question) => ({
      ...question,
      answer: question.id in answered ? { entryId: answered[question.id]!, answeredAt: '2026-10-19T09:00:00.000Z' } : question.answer,
      snoozedUntil: setAside[question.id] ?? question.snoozedUntil,
    })),
  }));
}

/** The overview of a memoir in progress, or of none (`program: null`). */
export function memoirOverview(
  program: Partial<MemoirProgram> | null = {},
  chapters: MemoirOverview['chapters'] = memoirChapters,
): MemoirOverview {
  return {
    program: program === null ? null : { ...memoirProgram, ...program },
    chapters,
    themes: memoirThemes,
    progress: { answered: 1, total: 3, words: 1200, estimatedPages: 5 },
    photoAnswers: [],
  };
}
