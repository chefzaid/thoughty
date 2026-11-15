import type { Language } from './translations';

/** The page the emailed password reset link opens. */
export type PasswordResetTranslationKey =
  | 'resetPasswordTitle'
  | 'resetPasswordIntro'
  | 'passwordRequirements'
  | 'passwordTooWeak'
  | 'resetPasswordSubmit'
  | 'resetPasswordDone'
  | 'resetPasswordMissingToken'
  | 'resetPasswordNewLinkIntro'
  | 'resetPasswordFailed';

export const passwordResetTranslations: Record<Language, Record<PasswordResetTranslationKey, string>> = {
  en: {
    resetPasswordTitle: 'Choose a new password',
    resetPasswordIntro: 'Every device signed in to your account will be signed out.',
    passwordRequirements:
      'At least 8 characters, with an uppercase letter, a lowercase letter, a number and one of these symbols: {symbols}',
    passwordTooWeak:
      'This password is too weak. Use at least 8 characters, with an uppercase letter, a lowercase letter, a number and one of these symbols: {symbols}',
    resetPasswordSubmit: 'Save the new password',
    resetPasswordDone:
      'Your password has been changed and every device was signed out. Sign in with your new password.',
    resetPasswordMissingToken: 'This password reset link is incomplete. Open the link from your email again.',
    resetPasswordNewLinkIntro: 'Enter your email to get a new link. It works once, for one hour.',
    resetPasswordFailed: 'Your password could not be changed. Try again.',
  },
  fr: {
    resetPasswordTitle: 'Choisissez un nouveau mot de passe',
    resetPasswordIntro: 'Tous les appareils connectés à votre compte seront déconnectés.',
    passwordRequirements:
      'Au moins 8 caractères, dont une majuscule, une minuscule, un chiffre et l’un de ces symboles : {symbols}',
    passwordTooWeak:
      'Ce mot de passe est trop faible. Utilisez au moins 8 caractères, dont une majuscule, une minuscule, un chiffre et l’un de ces symboles : {symbols}',
    resetPasswordSubmit: 'Enregistrer le nouveau mot de passe',
    resetPasswordDone:
      'Votre mot de passe a été modifié et tous les appareils ont été déconnectés. Connectez-vous avec votre nouveau mot de passe.',
    resetPasswordMissingToken: 'Ce lien de réinitialisation est incomplet. Ouvrez à nouveau le lien reçu par e-mail.',
    resetPasswordNewLinkIntro: 'Saisissez votre e-mail pour recevoir un nouveau lien. Il fonctionne une fois, pendant une heure.',
    resetPasswordFailed: 'Votre mot de passe n’a pas pu être modifié. Réessayez.',
  },
};
