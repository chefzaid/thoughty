import type { Language } from './translations';

export type DiaryAiTranslationKey =
  | 'diaryAiMode'
  | 'diaryAiModeOn'
  | 'diaryAiModeOff'
  | 'diaryAiModeHint'
  | 'diaryAiOffSummary'
  | 'diaryAiOffNotice'
  | 'diaryAiOffLeftOut';

/** The AI privacy mode of a diary, in Manage Diaries, and what the journal-wide AI actions say of it. */
export const diaryAiTranslations: Record<Language, Record<DiaryAiTranslationKey, string>> = {
  en: {
    diaryAiMode: 'AI',
    diaryAiModeOn: 'On',
    diaryAiModeOff: 'Off',
    diaryAiModeHint: 'With AI off, no AI feature reads this diary: its entries, their tags and files stay out of every AI action, chat, summary and analysis.',
    diaryAiOffSummary: 'AI off: no AI feature reads this diary',
    diaryAiOffNotice: 'AI is off for this diary: no AI feature reads its entries.',
    diaryAiOffLeftOut: 'Diaries with AI off are left out.',
  },
  fr: {
    diaryAiMode: 'IA',
    diaryAiModeOn: 'Activée',
    diaryAiModeOff: 'Désactivée',
    diaryAiModeHint: "Avec l'IA désactivée, aucune fonction d'IA ne lit ce journal : ses entrées, leurs tags et leurs fichiers restent hors de toute action, discussion, résumé et analyse d'IA.",
    diaryAiOffSummary: "IA désactivée : aucune fonction d'IA ne lit ce journal",
    diaryAiOffNotice: "L'IA est désactivée pour ce journal : aucune fonction d'IA ne lit ses entrées.",
    diaryAiOffLeftOut: "Les journaux dont l'IA est désactivée sont laissés de côté.",
  },
};
