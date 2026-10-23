import type { Language } from './translations';

export type FocusModeTranslationKey =
  | 'focusMode'
  | 'focusModeOpen'
  | 'focusModeDone'
  | 'focusModeLeave'
  | 'focusModeTextLabel'
  | 'focusModeWords_one'
  | 'focusModeWords_other'
  | 'focusModeGoalLabel'
  | 'focusModeGoalPlaceholder'
  | 'focusModeGoalProgress'
  | 'focusModeGoalProgressLabel'
  | 'focusModeGoalReached'
  | 'focusModeHint';

export const focusModeTranslations: Record<Language, Record<FocusModeTranslationKey, string>> = {
  en: {
    focusMode: 'Focus mode',
    focusModeOpen: 'Write in focus mode (Ctrl+Shift+F)',
    focusModeDone: 'Done',
    focusModeLeave: 'Leave focus mode (Esc)',
    focusModeTextLabel: 'Entry text',
    focusModeWords_one: '{count} word',
    focusModeWords_other: '{count} words',
    focusModeGoalLabel: 'Session goal in words',
    focusModeGoalPlaceholder: 'None',
    focusModeGoalProgress: '{written} of {goal} words this session',
    focusModeGoalProgressLabel: 'Progress toward the session goal',
    focusModeGoalReached: 'Session goal reached',
    focusModeHint: 'Esc or Ctrl+Shift+F to leave. Your draft stays as it is.',
  },
  fr: {
    focusMode: 'Mode concentration',
    focusModeOpen: 'Écrire en mode concentration (Ctrl+Maj+F)',
    focusModeDone: 'Terminé',
    focusModeLeave: 'Quitter le mode concentration (Échap)',
    focusModeTextLabel: 'Texte de l’entrée',
    focusModeWords_one: '{count} mot',
    focusModeWords_other: '{count} mots',
    focusModeGoalLabel: 'Objectif de la séance en mots',
    focusModeGoalPlaceholder: 'Aucun',
    focusModeGoalProgress: '{written} mots sur {goal} pendant cette séance',
    focusModeGoalProgressLabel: 'Progression vers l’objectif de la séance',
    focusModeGoalReached: 'Objectif de la séance atteint',
    focusModeHint: 'Échap ou Ctrl+Maj+F pour quitter. Votre brouillon reste tel quel.',
  },
};
