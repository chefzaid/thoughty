import type { Language } from './translations';

/** The offer to reread favorite or gratitude entries after a very low mood, and its Profile switch. */
export type ComfortReadsTranslationKey =
  | "comfortReadsTitle"
  | "comfortReadsIntro"
  | "comfortReadsUntitled"
  | "comfortReadsNotNow"
  | "comfortReadsNotNowHint"
  | "comfortReadsSetting"
  | "comfortReadsSettingDescription";

export const comfortReadsTranslations: Record<Language, Record<ComfortReadsTranslationKey, string>> = {
  en: {
    comfortReadsTitle: "A few pages you once held close",
    comfortReadsIntro: "If you'd like, here are entries you kept as favorites or wrote with gratitude.",
    comfortReadsUntitled: "Untitled entry",
    comfortReadsNotNow: "Not now",
    comfortReadsNotNowHint: "Put these away until another day",
    comfortReadsSetting: "Gentle rereads on hard days",
    comfortReadsSettingDescription: "After you note a very low mood, offer a few of your favorite or gratitude entries to reread, at most once a day",
  },
  fr: {
    comfortReadsTitle: "Quelques pages qui vous sont chères",
    comfortReadsIntro: "Si le cœur vous en dit, voici des entrées que vous avez gardées en favori ou écrites avec gratitude.",
    comfortReadsUntitled: "Entrée sans titre",
    comfortReadsNotNow: "Pas maintenant",
    comfortReadsNotNowHint: "Les ranger jusqu'à un autre jour",
    comfortReadsSetting: "Relectures douces les jours difficiles",
    comfortReadsSettingDescription: "Après une humeur très basse, vous proposer de relire quelques entrées favorites ou de gratitude, au plus une fois par jour",
  },
};
