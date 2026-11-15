import type { Language } from './translations';

/** The verify-first sign-up: the "check your email" step and the page the emailed link opens. */
export type SignUpTranslationKey =
  | 'signUpCheckEmailTitle'
  | 'signUpCheckEmailBody'
  | 'signUpCheckEmailPassword'
  | 'signUpResendEmail'
  | 'signUpResendIn'
  | 'signUpEmailResent'
  | 'signUpUseAnotherEmail'
  | 'completeSignUpTitle'
  | 'completeSignUpIntro'
  | 'completeSignUpUsernameTaken'
  | 'completeSignUpSubmit'
  | 'completeSignUpMissingToken'
  | 'completeSignUpFailed'
  | 'signUpAgain';

export const signUpTranslations: Record<Language, Record<SignUpTranslationKey, string>> = {
  en: {
    signUpCheckEmailTitle: 'Check your email',
    signUpCheckEmailBody:
      'We sent an email to {email}. Open the link in it to finish creating your account: it works once, for 24 hours. If this address already has an account, the email tells you how to sign in instead.',
    signUpCheckEmailPassword: 'The link asks for the password you just chose.',
    signUpResendEmail: 'Send the email again',
    signUpResendIn: 'Send the email again in {seconds} s',
    signUpEmailResent: 'If a new email was due, it is on its way.',
    signUpUseAnotherEmail: 'Use another email',
    completeSignUpTitle: 'Finish creating your account',
    completeSignUpIntro: 'Enter the password you chose when you signed up.',
    completeSignUpUsernameTaken: 'That username is already taken. Choose another one to finish.',
    completeSignUpSubmit: 'Create my account',
    completeSignUpMissingToken: 'This sign-up link is incomplete. Open the link from your email again.',
    completeSignUpFailed: 'Your account could not be created. Try again.',
    signUpAgain: 'Sign up again',
  },
  fr: {
    signUpCheckEmailTitle: 'Vérifiez vos e-mails',
    signUpCheckEmailBody:
      'Nous avons envoyé un e-mail à {email}. Ouvrez le lien qu’il contient pour terminer la création de votre compte : il ne fonctionne qu’une fois, pendant 24 heures. Si cette adresse a déjà un compte, l’e-mail vous explique comment vous connecter.',
    signUpCheckEmailPassword: 'Le lien vous demandera le mot de passe que vous venez de choisir.',
    signUpResendEmail: 'Renvoyer l’e-mail',
    signUpResendIn: 'Renvoyer l’e-mail dans {seconds} s',
    signUpEmailResent: 'Si un nouvel e-mail était prévu, il est en route.',
    signUpUseAnotherEmail: 'Utiliser une autre adresse',
    completeSignUpTitle: 'Terminez la création de votre compte',
    completeSignUpIntro: 'Saisissez le mot de passe choisi lors de votre inscription.',
    completeSignUpUsernameTaken: 'Ce nom d’utilisateur est déjà pris. Choisissez-en un autre pour terminer.',
    completeSignUpSubmit: 'Créer mon compte',
    completeSignUpMissingToken: 'Ce lien d’inscription est incomplet. Ouvrez à nouveau le lien reçu par e-mail.',
    completeSignUpFailed: 'Votre compte n’a pas pu être créé. Réessayez.',
    signUpAgain: 'Recommencer l’inscription',
  },
};
