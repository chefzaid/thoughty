import type { Language } from './translations';

/** Quiet mode: the setting, and the words that take the place of counts while it is on. */
export type QuietModeTranslationKey =
  | 'quietModeSetting'
  | 'quietModeSettingDescription'
  | 'quietModeNote'
  | 'quietModeComments'
  | 'quietModeMemoirTitle';

export const quietModeTranslations: Record<Language, Record<QuietModeTranslationKey, string>> = {
  en: {
    quietModeSetting: 'Quiet mode',
    quietModeSettingDescription: 'Hide streaks, badges, karma, likes, word and entry counts, and goal progress everywhere. Your entries and everything else stay.',
    quietModeNote: 'Quiet mode is on, so counts and goals are hidden here. You can turn it off under Appearance in your profile.',
    quietModeComments: 'Comments',
    quietModeMemoirTitle: 'Your memoir book',
  },
  fr: {
    quietModeSetting: 'Mode calme',
    quietModeSettingDescription: 'Masquer partout les séries, badges, karma, j’aime, nombres de mots et d’entrées, et l’avancée des objectifs. Vos entrées et tout le reste restent là.',
    quietModeNote: 'Le mode calme est activé : les nombres et les objectifs sont masqués ici. Vous pouvez le désactiver dans Apparence, sur votre profil.',
    quietModeComments: 'Commentaires',
    quietModeMemoirTitle: 'Votre livre de mémoires',
  },
};
