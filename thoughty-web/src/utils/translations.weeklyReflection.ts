import type { Language } from "./translations";

export type WeeklyReflectionTranslationKey =
  | "weeklyReflectionTitle"
  | "weeklyReflectionRange"
  | "weeklyReflectionIntro"
  | "weeklyReflectionEmpty"
  | "weeklyReflectionPrivacy"
  | "weeklyReflectionAction"
  | "weeklyReflectionAgain"
  | "weeklyReflectionReading"
  | "weeklyReflectionThemes"
  | "weeklyReflectionQuestion"
  | "weeklyReflectionError"
  | "weeklyReflectionLoadError";

export const weeklyReflectionTranslations: Record<Language, Record<WeeklyReflectionTranslationKey, string>> = {
  en: {
    weeklyReflectionTitle: "Your week",
    weeklyReflectionRange: "{start} to {end}",
    weeklyReflectionIntro: "Look back on the past seven days with AI: the themes that came back, a few words on how the week went, and one question for the week ahead.",
    weeklyReflectionEmpty: "Nothing written in the past seven days yet. Once you write, you can look back on your week here.",
    weeklyReflectionPrivacy: "Sends up to 21 entries of these seven days, 1,000 characters each, to the AI provider; locked entries are never sent. The reflection is kept until you ask again.",
    weeklyReflectionAction: "Reflect on my week",
    weeklyReflectionAgain: "Reflect again",
    weeklyReflectionReading: "Reading your week…",
    weeklyReflectionThemes: "What came back",
    weeklyReflectionQuestion: "A question for the week ahead",
    weeklyReflectionError: "Your week could not be read right now. Please try again in a moment.",
    weeklyReflectionLoadError: "Your week could not be loaded.",
  },
  fr: {
    weeklyReflectionTitle: "Votre semaine",
    weeklyReflectionRange: "Du {start} au {end}",
    weeklyReflectionIntro: "Revenez sur les sept derniers jours avec l’IA : les thèmes qui sont revenus, quelques mots sur la façon dont la semaine s’est passée, et une question pour la semaine qui vient.",
    weeklyReflectionEmpty: "Rien d’écrit ces sept derniers jours pour l’instant. Dès que vous écrirez, vous pourrez revenir ici sur votre semaine.",
    weeklyReflectionPrivacy: "Envoie au fournisseur d’IA jusqu’à 21 entrées de ces sept jours, 1 000 caractères chacune ; les entrées verrouillées ne sont jamais envoyées. Le bilan est gardé jusqu’à ce que vous le demandiez à nouveau.",
    weeklyReflectionAction: "Faire le bilan de ma semaine",
    weeklyReflectionAgain: "Refaire le bilan",
    weeklyReflectionReading: "Lecture de votre semaine…",
    weeklyReflectionThemes: "Ce qui est revenu",
    weeklyReflectionQuestion: "Une question pour la semaine qui vient",
    weeklyReflectionError: "Votre semaine n’a pas pu être lue pour le moment. Réessayez dans un instant.",
    weeklyReflectionLoadError: "Votre semaine n’a pas pu être chargée.",
  },
};
