import type { Language } from './translations';

/** The opt-in year in review email: its Profile section and what the unsubscribe page says once it is off. */
export type YearReviewEmailTranslationKey =
  | 'yearReviewEmailTitle'
  | 'yearReviewEmailIntro'
  | 'yearReviewEmailEnable'
  | 'yearReviewEmailEnableDescription'
  | 'yearReviewEmailPrivacy'
  | 'yearReviewEmailNext'
  | 'yearReviewEmailTurnedOn'
  | 'yearReviewEmailTurnedOff'
  | 'yearReviewEmailSaved'
  | 'yearReviewEmailLoadFailed'
  | 'yearReviewEmailSaveFailed'
  | 'yearReviewUnsubscribed';

export const yearReviewEmailTranslations: Record<Language, Record<YearReviewEmailTranslationKey, string>> = {
  en: {
    yearReviewEmailTitle: 'Year in review by email',
    yearReviewEmailIntro:
      'On January 1, get one email about the year just ended: how many entries, words and writing days, your longest streak and busiest month, your top tags, the moods you recorded, and a link to that year’s review.',
    yearReviewEmailEnable: 'Email me my year in review',
    yearReviewEmailEnableDescription: 'Off unless you turn it on. A year with no entries sends nothing.',
    yearReviewEmailPrivacy:
      'The email goes only to your verified address and holds no text from your entries, only counts, tag names and moods. Entries in the recycle bin and locked entries are left out, and no AI reads your entries.',
    yearReviewEmailNext: 'Next possible email: {date}.',
    yearReviewEmailTurnedOn: 'Year in review emails are on.',
    yearReviewEmailTurnedOff: 'Year in review emails are off.',
    yearReviewEmailSaved: 'Year in review email settings saved.',
    yearReviewEmailLoadFailed: 'The year in review email setting could not be loaded.',
    yearReviewEmailSaveFailed: 'The year in review email setting could not be saved.',
    yearReviewUnsubscribed:
      'You won’t receive year in review emails anymore. You can turn them back on in your profile at any time.',
  },
  fr: {
    yearReviewEmailTitle: 'Bilan de l’année par e-mail',
    yearReviewEmailIntro:
      'Le 1er janvier, recevez un e-mail sur l’année écoulée : le nombre d’entrées, de mots et de jours d’écriture, votre plus longue série et votre mois le plus actif, vos tags les plus utilisés, les humeurs que vous avez notées et un lien vers le bilan de cette année.',
    yearReviewEmailEnable: 'M’envoyer mon bilan de l’année par e-mail',
    yearReviewEmailEnableDescription: 'Désactivé tant que vous ne l’activez pas. Une année sans entrée n’envoie rien.',
    yearReviewEmailPrivacy:
      'L’e-mail est envoyé uniquement à votre adresse vérifiée et ne contient aucun texte de vos entrées, seulement des nombres, des noms de tags et des humeurs. Les entrées de la corbeille et les entrées verrouillées sont exclues, et aucune IA ne lit vos entrées.',
    yearReviewEmailNext: 'Prochain e-mail possible : {date}.',
    yearReviewEmailTurnedOn: 'Les e-mails de bilan de l’année sont activés.',
    yearReviewEmailTurnedOff: 'Les e-mails de bilan de l’année sont désactivés.',
    yearReviewEmailSaved: 'Réglages du bilan de l’année enregistrés.',
    yearReviewEmailLoadFailed: 'Le réglage du bilan de l’année n’a pas pu être chargé.',
    yearReviewEmailSaveFailed: 'Le réglage du bilan de l’année n’a pas pu être enregistré.',
    yearReviewUnsubscribed:
      'Vous ne recevrez plus les e-mails de bilan de l’année. Vous pouvez les réactiver à tout moment dans votre profil.',
  },
};
