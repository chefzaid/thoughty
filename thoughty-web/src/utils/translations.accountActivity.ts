import type { Language } from './translations';
import type { AccountEventKind } from '../services/api/accountActivityService';

/** The account activity in Profile › Privacy, and the email about a sign-in from a new browser. */
export type AccountActivityTranslationKey =
  | 'accountActivity'
  | 'accountActivityDescription'
  | 'accountActivityEmpty'
  | 'accountActivityLoadError'
  | 'accountActivityMore'
  | 'accountActivityWhen'
  | 'accountActivityWhat'
  | 'accountActivityFrom'
  | 'accountActivityFromValue'
  | 'accountActivityUnknownBrowser'
  | 'accountActivityUnknownSystem'
  | 'newBrowserEmail'
  | 'newBrowserEmailDescription'
  | 'newBrowserEmailSaveError'
  | `accountEvent_${AccountEventKind}`;

export const accountActivityTranslations: Record<Language, Record<AccountActivityTranslationKey, string>> = {
  en: {
    accountActivity: 'Account activity',
    accountActivityDescription:
      'The past year’s sign-ins, refused sign-ins and sign-outs, and every change to your account’s security, with the browser and system each came from (no IP address is kept). Something you do not recognize? Change your password and sign out the other sessions.',
    accountActivityEmpty: 'Nothing has happened on your account in the past year.',
    accountActivityLoadError: 'The account activity could not be loaded.',
    accountActivityMore: 'Show older activity',
    accountActivityWhen: 'When',
    accountActivityWhat: 'What',
    accountActivityFrom: 'Browser and system',
    accountActivityFromValue: '{browser} on {system}',
    accountActivityUnknownBrowser: 'Unknown browser',
    accountActivityUnknownSystem: 'unknown system',
    newBrowserEmail: 'Email me about a sign-in from a new browser',
    newBrowserEmailDescription:
      'When your account signs in from a browser and system it has not used in the past year, an email says which and when. It never holds anything you wrote.',
    newBrowserEmailSaveError: 'This setting could not be saved. Please try again.',
    accountEvent_sign_in: 'Signed in',
    accountEvent_sign_in_refused: 'Sign-in refused (wrong password or code)',
    accountEvent_sign_out: 'Signed out',
    accountEvent_sessions_revoked: 'Other sessions signed out',
    accountEvent_password_changed: 'Password changed',
    accountEvent_password_reset: 'Password reset by email',
    accountEvent_two_factor_enabled: 'Two-factor authentication turned on',
    accountEvent_two_factor_disabled: 'Two-factor authentication turned off',
    accountEvent_pin_set: 'PIN set',
    accountEvent_pin_changed: 'PIN changed',
    accountEvent_pin_reset: 'PIN reset',
    accountEvent_pin_removed: 'PIN and locks removed',
    accountEvent_data_downloaded: 'Data downloaded',
    accountEvent_journal_exported: 'Journal exported',
    accountEvent_share_link_created: 'Private share link made',
    accountEvent_share_link_revoked: 'Private share link revoked',
    accountEvent_access_token_created: 'Access token created',
    accountEvent_access_token_revoked: 'Access token revoked',
  },
  fr: {
    accountActivity: 'Activité du compte',
    accountActivityDescription:
      'Les connexions, connexions refusées et déconnexions de l’année écoulée, et chaque changement de la sécurité de votre compte, avec le navigateur et le système d’où chacun vient (aucune adresse IP n’est conservée). Quelque chose que vous ne reconnaissez pas ? Changez votre mot de passe et déconnectez les autres sessions.',
    accountActivityEmpty: 'Rien ne s’est passé sur votre compte au cours de l’année écoulée.',
    accountActivityLoadError: 'L’activité du compte n’a pas pu être chargée.',
    accountActivityMore: 'Afficher l’activité plus ancienne',
    accountActivityWhen: 'Quand',
    accountActivityWhat: 'Quoi',
    accountActivityFrom: 'Navigateur et système',
    accountActivityFromValue: '{browser} sous {system}',
    accountActivityUnknownBrowser: 'Navigateur inconnu',
    accountActivityUnknownSystem: 'système inconnu',
    newBrowserEmail: 'M’avertir par e-mail d’une connexion depuis un nouveau navigateur',
    newBrowserEmailDescription:
      'Quand votre compte est ouvert depuis un navigateur et un système qu’il n’a pas utilisés au cours de l’année écoulée, un e-mail indique lesquels et quand. Il ne contient jamais rien de ce que vous avez écrit.',
    newBrowserEmailSaveError: 'Ce réglage n’a pas pu être enregistré. Veuillez réessayer.',
    accountEvent_sign_in: 'Connexion',
    accountEvent_sign_in_refused: 'Connexion refusée (mot de passe ou code erroné)',
    accountEvent_sign_out: 'Déconnexion',
    accountEvent_sessions_revoked: 'Autres sessions déconnectées',
    accountEvent_password_changed: 'Mot de passe modifié',
    accountEvent_password_reset: 'Mot de passe réinitialisé par e-mail',
    accountEvent_two_factor_enabled: 'Authentification à deux facteurs activée',
    accountEvent_two_factor_disabled: 'Authentification à deux facteurs désactivée',
    accountEvent_pin_set: 'Code PIN défini',
    accountEvent_pin_changed: 'Code PIN modifié',
    accountEvent_pin_reset: 'Code PIN réinitialisé',
    accountEvent_pin_removed: 'Code PIN et verrous supprimés',
    accountEvent_data_downloaded: 'Données téléchargées',
    accountEvent_journal_exported: 'Journal exporté',
    accountEvent_share_link_created: 'Lien de partage privé créé',
    accountEvent_share_link_revoked: 'Lien de partage privé révoqué',
    accountEvent_access_token_created: 'Jeton d’accès créé',
    accountEvent_access_token_revoked: 'Jeton d’accès révoqué',
  },
};
