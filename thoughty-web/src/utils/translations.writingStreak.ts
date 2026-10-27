import type { Language } from './translations';

/** The journal's writing streak card, its pick-up-where-you-left-off prompt, and its Profile switch. */
export type WritingStreakTranslationKey =
  | "writingStreakRegion"
  | "writingStreakDays_one"
  | "writingStreakDays_other"
  | "writingStreakWrittenToday"
  | "writingStreakOpenToday"
  | "writingStreakResumeTitle"
  | "writingStreakResumeIntro"
  | "writingStreakUntitled"
  | "writingStreakWriteNow"
  | "writingStreakReread"
  | "writingStreakDismiss"
  | "writingStreakDismissHint"
  | "writingStreakLoadFailed"
  | "streakCardSetting"
  | "streakCardSettingDescription";

export const writingStreakTranslations: Record<Language, Record<WritingStreakTranslationKey, string>> = {
  en: {
    writingStreakRegion: "Writing streak",
    writingStreakDays_one: "{count} day in a row",
    writingStreakDays_other: "{count} days in a row",
    writingStreakWrittenToday: "Today's page is written. Lovely to see you here.",
    writingStreakOpenToday: "Today's page is open whenever you feel like writing.",
    writingStreakResumeTitle: "Pick up where you left off",
    writingStreakResumeIntro: "Welcome back. Your last entry is from {date}.",
    writingStreakUntitled: "Untitled entry",
    writingStreakWriteNow: "Write now",
    writingStreakReread: "Reread it",
    writingStreakDismiss: "Hide until tomorrow",
    writingStreakDismissHint: "Hide this card until tomorrow. You can turn it off in Profile.",
    writingStreakLoadFailed: "Your writing streak could not be loaded.",
    streakCardSetting: "Writing streak card",
    streakCardSettingDescription: "Show your days in a row above the journal, and an offer to pick up where you left off after a break",
  },
  fr: {
    writingStreakRegion: "Série d'écriture",
    writingStreakDays_one: "{count} jour d'affilée",
    writingStreakDays_other: "{count} jours d'affilée",
    writingStreakWrittenToday: "La page du jour est écrite. Ravi de vous retrouver ici.",
    writingStreakOpenToday: "La page du jour vous attend, quand vous aurez envie d'écrire.",
    writingStreakResumeTitle: "Reprendre là où vous en étiez",
    writingStreakResumeIntro: "Bon retour. Votre dernière entrée date du {date}.",
    writingStreakUntitled: "Entrée sans titre",
    writingStreakWriteNow: "Écrire maintenant",
    writingStreakReread: "La relire",
    writingStreakDismiss: "Masquer jusqu'à demain",
    writingStreakDismissHint: "Masquer cette carte jusqu'à demain. Vous pouvez la désactiver dans le Profil.",
    writingStreakLoadFailed: "Impossible de charger votre série d'écriture.",
    streakCardSetting: "Carte de série d'écriture",
    streakCardSettingDescription: "Afficher vos jours d'affilée au-dessus du journal, et une invitation à reprendre là où vous en étiez après une pause",
  },
};
