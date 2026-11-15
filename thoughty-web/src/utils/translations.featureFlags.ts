import type { Language } from './translations';

/** What the app says where a feature switched off by its runtime flag would be. */
export type FeatureFlagsTranslationKey =
  | 'featureOffAi'
  | 'featureOffBookConverter'
  | 'featureOffCloudSync'
  | 'featureOffPublicSharing'
  | 'featureOffPublicVisibility';

export const featureFlagsTranslations: Record<Language, Record<FeatureFlagsTranslationKey, string>> = {
  en: {
    featureOffAi: 'AI features are turned off for now. Everything else works as usual, and your AI settings are kept.',
    featureOffBookConverter: 'The book converter is turned off for now. Your entries and saved book versions are kept.',
    featureOffCloudSync: 'Cloud sync is turned off for now. Your connections and schedules are kept, and syncing starts again when it is back.',
    featureOffPublicSharing: 'Sharing is turned off for now: the feed and private links are paused. Nothing you shared was changed, and it all comes back when sharing is on again.',
    featureOffPublicVisibility: 'Sharing is turned off for now, so new entries are saved private. Entries already public stay public.',
  },
  fr: {
    featureOffAi: 'Les fonctions d’IA sont désactivées pour le moment. Tout le reste fonctionne normalement, et vos réglages d’IA sont conservés.',
    featureOffBookConverter: 'Le convertisseur de livres est désactivé pour le moment. Vos entrées et les versions enregistrées de vos livres sont conservées.',
    featureOffCloudSync: 'La synchronisation cloud est désactivée pour le moment. Vos connexions et vos planifications sont conservées, et la synchronisation reprendra à son retour.',
    featureOffPublicSharing: 'Le partage est désactivé pour le moment : le fil et les liens privés sont en pause. Rien de ce que vous avez partagé n’a changé, et tout revient quand le partage est réactivé.',
    featureOffPublicVisibility: 'Le partage est désactivé pour le moment : les nouvelles entrées sont enregistrées en privé. Les entrées déjà publiques le restent.',
  },
};
