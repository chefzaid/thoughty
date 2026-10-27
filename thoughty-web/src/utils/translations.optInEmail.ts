import type { Language } from './translations';

/** What the opt-in emails' Profile sections share, and the unsubscribe page their links open. */
export type OptInEmailTranslationKey =
  | 'optInEmailHour'
  | 'optInEmailTimeZone'
  | 'optInEmailDiary'
  | 'optInEmailAllDiaries'
  | 'optInEmailUnavailable'
  | 'optInEmailLoading'
  | 'emailUnsubscribeTitle'
  | 'emailUnsubscribing'
  | 'emailUnsubscribeMissing'
  | 'emailUnsubscribeFailed';

export const optInEmailTranslations: Record<Language, Record<OptInEmailTranslationKey, string>> = {
  en: {
    optInEmailHour: 'Delivery time',
    optInEmailTimeZone: 'Time zone',
    optInEmailDiary: 'Diary',
    optInEmailAllDiaries: 'All diaries',
    optInEmailUnavailable:
      'We can’t email you yet: your email address must be verified and this server must be able to send email.',
    optInEmailLoading: 'Loading the email setting…',
    emailUnsubscribeTitle: 'Unsubscribe',
    emailUnsubscribing: 'Turning off these emails…',
    emailUnsubscribeMissing: 'This unsubscribe link is incomplete. Open the link from the email again.',
    emailUnsubscribeFailed: 'The emails could not be turned off. Please try again.',
  },
  fr: {
    optInEmailHour: 'Heure d’envoi',
    optInEmailTimeZone: 'Fuseau horaire',
    optInEmailDiary: 'Journal',
    optInEmailAllDiaries: 'Tous les journaux',
    optInEmailUnavailable:
      'Nous ne pouvons pas encore vous écrire : votre adresse e-mail doit être vérifiée et ce serveur doit pouvoir envoyer des e-mails.',
    optInEmailLoading: 'Chargement du réglage de l’e-mail…',
    emailUnsubscribeTitle: 'Désabonnement',
    emailUnsubscribing: 'Désactivation de ces e-mails…',
    emailUnsubscribeMissing: 'Ce lien de désabonnement est incomplet. Rouvrez le lien depuis l’e-mail.',
    emailUnsubscribeFailed: 'Les e-mails n’ont pas pu être désactivés. Veuillez réessayer.',
  },
};
