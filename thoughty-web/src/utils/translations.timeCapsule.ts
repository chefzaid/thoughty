import type { Language } from './translations';

/** Time capsules: sealing an entry in the composer, the sealed card, opening early, and Highlights. */
export type TimeCapsuleTranslationKey =
  | 'timeCapsuleSeal'
  | 'timeCapsuleOpensOn'
  | 'timeCapsuleOpenHour'
  | 'timeCapsuleSealHint'
  | 'timeCapsuleDateRequired'
  | 'timeCapsuleVisibilityLocked'
  | 'timeCapsuleCardTitle'
  | 'timeCapsuleSealedUntil'
  | 'timeCapsuleSealedHint'
  | 'timeCapsuleOpenEarly'
  | 'timeCapsuleOpenEarlyTitle'
  | 'timeCapsuleOpenEarlyMessage'
  | 'timeCapsuleOpenEarlyConfirm'
  | 'timeCapsuleOpened'
  | 'timeCapsuleOpenFailed'
  | 'timeCapsuleSealedLabel'
  | 'timeCapsuleHighlightsTitle'
  | 'timeCapsuleSealedOn'
  | 'timeCapsuleOpenedEarly';

export const timeCapsuleTranslations: Record<Language, Record<TimeCapsuleTranslationKey, string>> = {
  en: {
    timeCapsuleSeal: 'Seal as a time capsule',
    timeCapsuleOpensOn: 'Opens on',
    timeCapsuleOpenHour: 'Opens at',
    timeCapsuleSealHint:
      'It opens at that time in your time zone ({zone}). Until then its words, title, tags, mood and files stay hidden, even from you, and it stays private. It is emailed to you when it opens.',
    timeCapsuleDateRequired: 'Choose an opening date from tomorrow up to 50 years ahead.',
    timeCapsuleVisibilityLocked: 'A time capsule stays private while it is sealed',
    timeCapsuleCardTitle: 'Time capsule',
    timeCapsuleSealedUntil: 'Sealed until {date}',
    timeCapsuleSealedHint: 'Its words, title, tags and files stay hidden until then. It will be emailed to you when it opens.',
    timeCapsuleOpenEarly: 'Open early',
    timeCapsuleOpenEarlyTitle: 'Open this time capsule now?',
    timeCapsuleOpenEarlyMessage: 'It was sealed until {date}. Opening it now shows it in your journal straight away and cannot be undone; no email is sent.',
    timeCapsuleOpenEarlyConfirm: 'Open now',
    timeCapsuleOpened: 'Time capsule opened',
    timeCapsuleOpenFailed: 'Could not open the time capsule. Please try again.',
    timeCapsuleSealedLabel: 'Sealed time capsule',
    timeCapsuleHighlightsTitle: 'Time capsules opened',
    timeCapsuleSealedOn: 'Sealed on {date}',
    timeCapsuleOpenedEarly: 'Opened early',
  },
  fr: {
    timeCapsuleSeal: 'Sceller comme capsule temporelle',
    timeCapsuleOpensOn: 'S’ouvre le',
    timeCapsuleOpenHour: 'À l’heure',
    timeCapsuleSealHint:
      'Elle s’ouvre à cette heure dans votre fuseau horaire ({zone}). D’ici là, ses mots, son titre, ses tags, son humeur et ses fichiers restent cachés, même pour vous, et elle reste privée. Elle vous est envoyée par e-mail à son ouverture.',
    timeCapsuleDateRequired: 'Choisissez une date d’ouverture entre demain et dans 50 ans.',
    timeCapsuleVisibilityLocked: 'Une capsule temporelle reste privée tant qu’elle est scellée',
    timeCapsuleCardTitle: 'Capsule temporelle',
    timeCapsuleSealedUntil: 'Scellée jusqu’au {date}',
    timeCapsuleSealedHint: 'Ses mots, son titre, ses tags et ses fichiers restent cachés jusque-là. Elle vous sera envoyée par e-mail à son ouverture.',
    timeCapsuleOpenEarly: 'Ouvrir maintenant',
    timeCapsuleOpenEarlyTitle: 'Ouvrir cette capsule temporelle maintenant ?',
    timeCapsuleOpenEarlyMessage: 'Elle était scellée jusqu’au {date}. L’ouvrir maintenant l’affiche aussitôt dans votre journal, sans retour possible ; aucun e-mail n’est envoyé.',
    timeCapsuleOpenEarlyConfirm: 'Ouvrir',
    timeCapsuleOpened: 'Capsule temporelle ouverte',
    timeCapsuleOpenFailed: 'Impossible d’ouvrir la capsule temporelle. Veuillez réessayer.',
    timeCapsuleSealedLabel: 'Capsule temporelle scellée',
    timeCapsuleHighlightsTitle: 'Capsules temporelles ouvertes',
    timeCapsuleSealedOn: 'Scellée le {date}',
    timeCapsuleOpenedEarly: 'Ouverte en avance',
  },
};
