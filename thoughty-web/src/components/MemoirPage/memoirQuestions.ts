import type { MemoirChapter } from '../../services/api';

/** A question of the memoir with the chapter it belongs to, or null when no chapter holds it. */
export function findQuestion(chapters: readonly MemoirChapter[], questionId: string | null) {
  for (const chapter of chapters) {
    const question = chapter.questions.find((candidate) => candidate.id === questionId);
    if (question) return { chapter, question };
  }
  return null;
}

/** The first day a question set aside with "Not this week" comes back, among those still unanswered. */
export function firstReturnDay(chapters: readonly MemoirChapter[]): string | null {
  const days = chapters.flatMap((chapter) => chapter.questions.map((question) => question.snoozedUntil)).filter((day) => day !== null);
  return days.length > 0 ? days.reduce((first, day) => (day < first ? day : first)) : null;
}
