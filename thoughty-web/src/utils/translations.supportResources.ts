import type { Language } from './translations';

/** The support resources shown when an entry or a chat carries a sign of crisis, and on the support page. */
export type SupportResourcesTranslationKey =
  | "supportTitle"
  | "supportIntro"
  | "supportEmergencyRegion"
  | "supportEmergencyDetail"
  | "supportFranceRegion"
  | "supportFranceDetail"
  | "supportUkIrelandRegion"
  | "supportUkIrelandDetail"
  | "supportUsCanadaRegion"
  | "supportUsCanadaDetail"
  | "supportElsewhereRegion"
  | "supportElsewhereDetail"
  | "supportNotTherapy"
  | "supportClose"
  | "supportCloseHint"
  | "contactSupportKicker";

export const supportResourcesTranslations: Record<Language, Record<SupportResourcesTranslationKey, string>> = {
  en: {
    supportTitle: "You don't have to face this alone",
    supportIntro: "If you are thinking about suicide or hurting yourself, or you are in danger, please reach out now. Someone is there to listen, day and night.",
    supportEmergencyRegion: "Emergency",
    supportEmergencyDetail: "in Europe, or your local emergency number",
    supportFranceRegion: "France",
    supportFranceDetail: "national suicide prevention line, free, day and night",
    supportUkIrelandRegion: "UK and Ireland",
    supportUkIrelandDetail: "Samaritans, free, day and night",
    supportUsCanadaRegion: "United States and Canada",
    supportUsCanadaDetail: "call or text the Suicide and Crisis Lifeline",
    supportElsewhereRegion: "Anywhere else",
    supportElsewhereDetail: "free helplines in your country",
    supportNotTherapy: "Thoughty and its AI companion are not a replacement for a doctor, a therapist or a crisis line.",
    supportClose: "Close",
    supportCloseHint: "Hide these resources",
    contactSupportKicker: "In a crisis",
  },
  fr: {
    supportTitle: "De l'aide est là pour vous",
    supportIntro: "Si vous pensez au suicide ou à vous faire du mal, ou si vous êtes en danger, parlez-en maintenant. Quelqu'un est là pour vous écouter, jour et nuit.",
    supportEmergencyRegion: "Urgence",
    supportEmergencyDetail: "en Europe, ou le numéro d'urgence de votre pays",
    supportFranceRegion: "France",
    supportFranceDetail: "numéro national de prévention du suicide, gratuit, jour et nuit",
    supportUkIrelandRegion: "Royaume-Uni et Irlande",
    supportUkIrelandDetail: "Samaritans, gratuit, jour et nuit",
    supportUsCanadaRegion: "États-Unis et Canada",
    supportUsCanadaDetail: "appel ou SMS, Suicide and Crisis Lifeline",
    supportElsewhereRegion: "Ailleurs",
    supportElsewhereDetail: "les lignes d'écoute gratuites de votre pays",
    supportNotTherapy: "Thoughty et son assistant IA ne remplacent ni un médecin, ni un thérapeute, ni une ligne d'écoute.",
    supportClose: "Fermer",
    supportCloseHint: "Masquer ces ressources",
    contactSupportKicker: "En cas de crise",
  },
};
