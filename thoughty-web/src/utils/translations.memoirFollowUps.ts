import type { Language } from './translations';

/** Memoir interview mode: AI follow-up questions that deepen an answer, in the answer form. */
export type MemoirFollowUpsTranslationKey =
  | 'memoirFollowUpsTitle'
  | 'memoirFollowUpsHint'
  | 'memoirFollowUpsNeedText'
  | 'memoirFollowUpsAsk'
  | 'memoirFollowUpsAskMore'
  | 'memoirFollowUpsAsking'
  | 'memoirFollowUpsList'
  | 'memoirFollowUpsUse'
  | 'memoirFollowUpsUseLabel'
  | 'memoirFollowUpsAdded'
  | 'memoirFollowUpsNone'
  | 'memoirFollowUpsError';

export const memoirFollowUpsTranslations: Record<Language, Record<MemoirFollowUpsTranslationKey, string>> = {
  en: {
    memoirFollowUpsTitle: 'Interview mode',
    memoirFollowUpsHint: 'The AI reads this question and your answer and asks only about what you wrote, to help you tell more. Nothing is kept.',
    memoirFollowUpsNeedText: 'Write some of your answer first: the questions build only on what you wrote.',
    memoirFollowUpsAsk: 'Ask me follow-up questions',
    memoirFollowUpsAskMore: 'Ask me other questions',
    memoirFollowUpsAsking: 'Thinking of questions…',
    memoirFollowUpsList: 'To tell more',
    memoirFollowUpsUse: 'Answer this',
    memoirFollowUpsUseLabel: 'Answer this: {question}',
    memoirFollowUpsAdded: 'Question added to the end of your answer.',
    memoirFollowUpsNone: 'Write a little more first: the questions build only on what you wrote.',
    memoirFollowUpsError: 'The follow-up questions could not be asked. Try again later.',
  },
  fr: {
    memoirFollowUpsTitle: 'Mode entretien',
    memoirFollowUpsHint: 'L’IA lit cette question et votre réponse, et ne vous interroge que sur ce que vous avez écrit, pour vous aider à en dire plus. Rien n’est conservé.',
    memoirFollowUpsNeedText: 'Écrivez d’abord une partie de votre réponse : les questions ne partent que de ce que vous avez écrit.',
    memoirFollowUpsAsk: 'Me poser des questions de relance',
    memoirFollowUpsAskMore: 'Me poser d’autres questions',
    memoirFollowUpsAsking: 'Questions en préparation…',
    memoirFollowUpsList: 'Pour en dire plus',
    memoirFollowUpsUse: 'Y répondre',
    memoirFollowUpsUseLabel: 'Y répondre : {question}',
    memoirFollowUpsAdded: 'Question ajoutée à la fin de votre réponse.',
    memoirFollowUpsNone: 'Écrivez-en un peu plus d’abord : les questions ne partent que de ce que vous avez écrit.',
    memoirFollowUpsError: 'Les questions de relance n’ont pas pu être posées. Réessayez plus tard.',
  },
};
