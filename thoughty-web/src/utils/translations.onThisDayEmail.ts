import type { Language } from './translations';

/** The opt-in "On this day" email: its Profile section and the unsubscribe page its links open. */
export type OnThisDayEmailTranslationKey =
  | 'onThisDayEmailTitle'
  | 'onThisDayEmailIntro'
  | 'onThisDayEmailEnable'
  | 'onThisDayEmailEnableDescription'
  | 'onThisDayEmailHour'
  | 'onThisDayEmailTimeZone'
  | 'onThisDayEmailDiary'
  | 'onThisDayEmailAllDiaries'
  | 'onThisDayEmailPrivacy'
  | 'onThisDayEmailNext'
  | 'onThisDayEmailUnavailable'
  | 'onThisDayEmailTurnedOn'
  | 'onThisDayEmailTurnedOff'
  | 'onThisDayEmailSaved'
  | 'onThisDayEmailLoading'
  | 'onThisDayEmailLoadFailed'
  | 'onThisDayEmailSaveFailed'
  | 'onThisDayUnsubscribeTitle'
  | 'onThisDayUnsubscribing'
  | 'onThisDayUnsubscribed'
  | 'onThisDayUnsubscribeMissing'
  | 'onThisDayUnsubscribeFailed';

export const onThisDayEmailTranslations: Record<Language, Record<OnThisDayEmailTranslationKey, string>> = {
  en: {
    onThisDayEmailTitle: 'On this day by email',
    onThisDayEmailIntro:
      'On days when you wrote in earlier years, get one email with those entries: each title, its first lines, and a link to open it in your journal.',
    onThisDayEmailEnable: 'Email me “On this day”',
    onThisDayEmailEnableDescription: 'Off unless you turn it on. Days without past entries send nothing.',
    onThisDayEmailHour: 'Delivery time',
    onThisDayEmailTimeZone: 'Time zone',
    onThisDayEmailDiary: 'Diary',
    onThisDayEmailAllDiaries: 'All diaries',
    onThisDayEmailPrivacy:
      'The email goes only to your verified address and can include private entries, never more than their title and first 200 characters. Entries in the recycle bin are left out.',
    onThisDayEmailNext: 'Next possible email: {date}.',
    onThisDayEmailUnavailable:
      'We can’t email you yet: your email address must be verified and this server must be able to send email.',
    onThisDayEmailTurnedOn: '“On this day” emails are on.',
    onThisDayEmailTurnedOff: '“On this day” emails are off.',
    onThisDayEmailSaved: '“On this day” email settings saved.',
    onThisDayEmailLoading: 'Loading the email setting…',
    onThisDayEmailLoadFailed: 'The “On this day” email setting could not be loaded.',
    onThisDayEmailSaveFailed: 'The “On this day” email setting could not be saved.',
    onThisDayUnsubscribeTitle: 'Unsubscribe',
    onThisDayUnsubscribing: 'Turning off “On this day” emails…',
    onThisDayUnsubscribed:
      'You won’t receive “On this day” emails anymore. You can turn them back on in your profile at any time.',
    onThisDayUnsubscribeMissing: 'This unsubscribe link is incomplete. Open the link from the email again.',
    onThisDayUnsubscribeFailed: 'The emails could not be turned off. Please try again.',
  },
  fr: {
    onThisDayEmailTitle: 'Ce jour-là par e-mail',
    onThisDayEmailIntro:
      'Les jours où vous avez écrit les années passées, recevez un e-mail avec ces entrées : le titre de chacune, ses premières lignes et un lien pour l’ouvrir dans votre journal.',
    onThisDayEmailEnable: 'M’envoyer « Ce jour-là » par e-mail',
    onThisDayEmailEnableDescription: 'Désactivé tant que vous ne l’activez pas. Les jours sans entrées passées, rien n’est envoyé.',
    onThisDayEmailHour: 'Heure d’envoi',
    onThisDayEmailTimeZone: 'Fuseau horaire',
    onThisDayEmailDiary: 'Journal',
    onThisDayEmailAllDiaries: 'Tous les journaux',
    onThisDayEmailPrivacy:
      'L’e-mail est envoyé uniquement à votre adresse vérifiée et peut contenir des entrées privées, jamais plus que leur titre et leurs 200 premiers caractères. Les entrées de la corbeille sont exclues.',
    onThisDayEmailNext: 'Prochain e-mail possible : {date}.',
    onThisDayEmailUnavailable:
      'Nous ne pouvons pas encore vous écrire : votre adresse e-mail doit être vérifiée et ce serveur doit pouvoir envoyer des e-mails.',
    onThisDayEmailTurnedOn: 'Les e-mails « Ce jour-là » sont activés.',
    onThisDayEmailTurnedOff: 'Les e-mails « Ce jour-là » sont désactivés.',
    onThisDayEmailSaved: 'Réglages de l’e-mail « Ce jour-là » enregistrés.',
    onThisDayEmailLoading: 'Chargement du réglage de l’e-mail…',
    onThisDayEmailLoadFailed: 'Le réglage de l’e-mail « Ce jour-là » n’a pas pu être chargé.',
    onThisDayEmailSaveFailed: 'Le réglage de l’e-mail « Ce jour-là » n’a pas pu être enregistré.',
    onThisDayUnsubscribeTitle: 'Désabonnement',
    onThisDayUnsubscribing: 'Désactivation des e-mails « Ce jour-là »…',
    onThisDayUnsubscribed:
      'Vous ne recevrez plus les e-mails « Ce jour-là ». Vous pouvez les réactiver à tout moment dans votre profil.',
    onThisDayUnsubscribeMissing: 'Ce lien de désabonnement est incomplet. Rouvrez le lien depuis l’e-mail.',
    onThisDayUnsubscribeFailed: 'Les e-mails n’ont pas pu être désactivés. Veuillez réessayer.',
  },
};
