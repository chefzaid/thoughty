import type { Language } from './translations';

/** The page a writer whose account has no email address sees at sign-in, until they add one. */
export type AddEmailTranslationKey =
  | 'addEmailTitle'
  | 'addEmailIntro'
  | 'addEmailSubmit'
  | 'addEmailSaving'
  | 'addEmailFailed'
  | 'addEmailCheckInbox'
  | 'addEmailOpenedLink'
  | 'addEmailNotConfirmedYet'
  | 'addEmailResend'
  | 'addEmailResent';

export const addEmailTranslations: Record<Language, Record<AddEmailTranslationKey, string>> = {
  en: {
    addEmailTitle: 'Add your email address',
    addEmailIntro:
      'Your account has no email address yet. Add one you can read: Thoughty uses it for sign-in codes, password reset links and the emails you choose to receive.',
    addEmailSubmit: 'Send the confirmation link',
    addEmailSaving: 'Sending…',
    addEmailFailed: 'Your email address could not be saved. Try again.',
    addEmailCheckInbox:
      'We sent a link to {email}. Open it to confirm this address: it works once, for 24 hours.',
    addEmailOpenedLink: 'I opened the link',
    addEmailNotConfirmedYet: 'This address is not confirmed yet. Open the link in the email we sent.',
    addEmailResend: 'Send the link again',
    addEmailResent: 'A new link is on its way.',
  },
  fr: {
    addEmailTitle: 'Ajoutez votre adresse e-mail',
    addEmailIntro:
      'Votre compte n’a pas encore d’adresse e-mail. Ajoutez-en une que vous pouvez lire : Thoughty s’en sert pour les codes de connexion, les liens de réinitialisation du mot de passe et les e-mails que vous choisissez de recevoir.',
    addEmailSubmit: 'Envoyer le lien de confirmation',
    addEmailSaving: 'Envoi…',
    addEmailFailed: 'Votre adresse e-mail n’a pas pu être enregistrée. Réessayez.',
    addEmailCheckInbox:
      'Nous avons envoyé un lien à {email}. Ouvrez-le pour confirmer cette adresse : il ne fonctionne qu’une fois, pendant 24 heures.',
    addEmailOpenedLink: 'J’ai ouvert le lien',
    addEmailNotConfirmedYet: 'Cette adresse n’est pas encore confirmée. Ouvrez le lien de l’e-mail que nous avons envoyé.',
    addEmailResend: 'Renvoyer le lien',
    addEmailResent: 'Un nouveau lien est en route.',
  },
};
