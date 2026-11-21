import type { MemoirChapter, MemoirProgram, MemoirQuestion } from '../../services/api';
import { findQuestion, firstReturnDay } from '../MemoirPage/memoirQuestions';

/** What the simple memoir screen shows of a memoir in progress. */
export type SimpleMemoirView =
  | { readonly kind: 'noDiary' }
  | { readonly kind: 'ask'; readonly question: MemoirQuestion; readonly chapter: MemoirChapter }
  | { readonly kind: 'answered' }
  | { readonly kind: 'setAside'; readonly returnDay: string }
  | { readonly kind: 'complete' };

/**
 * The one question to answer: the one a link asked for while it is still unanswered (the weekly email's),
 * else this week's; otherwise why there is none (answered this week, every question left set aside, or all answered).
 */
export function pickSimpleMemoirView(
  program: MemoirProgram,
  chapters: readonly MemoirChapter[],
  requestedQuestionId: string | null,
): SimpleMemoirView {
  if (!program.diaryId) return { kind: 'noDiary' };

  const requested = findQuestion(chapters, requestedQuestionId);
  if (requested && !requested.question.answer) return { kind: 'ask', ...requested };

  const current = findQuestion(chapters, program.currentQuestionId);
  if (current) return current.question.answer ? { kind: 'answered' } : { kind: 'ask', ...current };

  const returnDay = firstReturnDay(chapters);
  return returnDay ? { kind: 'setAside', returnDay } : { kind: 'complete' };
}
