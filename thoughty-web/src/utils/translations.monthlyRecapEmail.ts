import type { Language } from './translations';

/** The opt-in monthly recap email: its Profile section and what the unsubscribe page says once it is off. */
export type MonthlyRecapEmailTranslationKey =
  | 'monthlyRecapEmailTitle'
  | 'monthlyRecapEmailIntro'
  | 'monthlyRecapEmailEnable'
  | 'monthlyRecapEmailEnableDescription'
  | 'monthlyRecapEmailPrivacy'
  | 'monthlyRecapEmailNext'
  | 'monthlyRecapEmailTurnedOn'
  | 'monthlyRecapEmailTurnedOff'
  | 'monthlyRecapEmailSaved'
  | 'monthlyRecapEmailLoadFailed'
  | 'monthlyRecapEmailSaveFailed'
  | 'monthlyRecapUnsubscribed';

export const monthlyRecapEmailTranslations: Record<Language, Record<MonthlyRecapEmailTranslationKey, string>> = {
  en: {
    monthlyRecapEmailTitle: 'Monthly recap by email',
    monthlyRecapEmailIntro:
      'On the 1st of each month, get one email about the month just ended: how many entries, words and writing days, your top tags, the moods you recorded, a memory from the same month in an earlier year, and a link to your year in review.',
    monthlyRecapEmailEnable: 'Email me a monthly recap',
    monthlyRecapEmailEnableDescription:
      'Off unless you turn it on. A month with no entries and no memory from earlier years sends nothing.',
    monthlyRecapEmailPrivacy:
      'The email goes only to your verified address. The memory can be a private entry and shows no more than its title and first 200 characters. Entries in the recycle bin are left out, and no AI reads your entries.',
    monthlyRecapEmailNext: 'Next possible recap: {date}.',
    monthlyRecapEmailTurnedOn: 'Monthly recap emails are on.',
    monthlyRecapEmailTurnedOff: 'Monthly recap emails are off.',
    monthlyRecapEmailSaved: 'Monthly recap email settings saved.',
    monthlyRecapEmailLoadFailed: 'The monthly recap email setting could not be loaded.',
    monthlyRecapEmailSaveFailed: 'The monthly recap email setting could not be saved.',
    monthlyRecapUnsubscribed:
      'You won’t receive monthly recap emails anymore. You can turn them back on in your profile at any time.',
  },
  fr: {
    monthlyRecapEmailTitle: 'Bilan mensuel par e-mail',
    monthlyRecapEmailIntro:
      'Le 1er de chaque mois, recevez un e-mail sur le mois écoulé : le nombre d’entrées, de mots et de jours d’écriture, vos tags les plus utilisés, les humeurs que vous avez notées, un souvenir du même mois d’une année passée et un lien vers votre bilan de l’année.',
    monthlyRecapEmailEnable: 'M’envoyer un bilan mensuel par e-mail',
    monthlyRecapEmailEnableDescription:
      'Désactivé tant que vous ne l’activez pas. Un mois sans entrée ni souvenir des années passées n’envoie rien.',
    monthlyRecapEmailPrivacy:
      'L’e-mail est envoyé uniquement à votre adresse vérifiée. Le souvenir peut être une entrée privée et n’en montre que le titre et les 200 premiers caractères. Les entrées de la corbeille sont exclues, et aucune IA ne lit vos entrées.',
    monthlyRecapEmailNext: 'Prochain bilan possible : {date}.',
    monthlyRecapEmailTurnedOn: 'Les e-mails de bilan mensuel sont activés.',
    monthlyRecapEmailTurnedOff: 'Les e-mails de bilan mensuel sont désactivés.',
    monthlyRecapEmailSaved: 'Réglages du bilan mensuel enregistrés.',
    monthlyRecapEmailLoadFailed: 'Le réglage du bilan mensuel n’a pas pu être chargé.',
    monthlyRecapEmailSaveFailed: 'Le réglage du bilan mensuel n’a pas pu être enregistré.',
    monthlyRecapUnsubscribed:
      'Vous ne recevrez plus les e-mails de bilan mensuel. Vous pouvez les réactiver à tout moment dans votre profil.',
  },
};
