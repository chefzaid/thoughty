import type { Language } from './translations';

export type DiaryAiTranslationKey =
  | 'diaryAiMode'
  | 'diaryAiModeOn'
  | 'diaryAiModeOff'
  | 'diaryAiModeHint'
  | 'diaryAiOffSummary';

/** The AI privacy mode of a diary, in Manage Diaries. */
export const diaryAiTranslations: Record<Language, Record<DiaryAiTranslationKey, string>> = {
  en: {
    diaryAiMode: 'AI',
    diaryAiModeOn: 'On',
    diaryAiModeOff: 'Off',
    diaryAiModeHint: 'With AI off, no AI feature reads this diary: its entries, their tags and files stay out of every AI action, chat, summary and analysis.',
    diaryAiOffSummary: 'AI off: no AI feature reads this diary',
  },
  fr: {
    diaryAiMode: 'IA',
    diaryAiModeOn: 'Activée',
    diaryAiModeOff: 'Désactivée',
    diaryAiModeHint: "Avec l'IA désactivée, aucune fonction d'IA ne lit ce journal : ses entrées, leurs tags et leurs fichiers restent hors de toute action, discussion, résumé et analyse d'IA.",
    diaryAiOffSummary: "IA désactivée : aucune fonction d'IA ne lit ce journal",
  },
};
