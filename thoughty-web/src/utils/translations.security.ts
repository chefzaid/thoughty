import type { Language } from './translations';

/** Password change, two-factor authentication, active sessions and email verification. */
export type SecurityTranslationKey =
  | "activeSessions"
  | "activeSessionsDescription"
  | "noActiveSessions"
  | "session"
  | "sessionCreated"
  | "sessionExpires"
  | "sessionAction"
  | "currentSession"
  | "sessionNumber"
  | "revoke"
  | "revoking"
  | "signOutOtherSessions"
  | "sessionsLoadError"
  | "sessionRevokeError"
  | "sessionRevoked"
  | "otherSessionsRevoked"
  | "security"
  | "currentPassword"
  | "newPassword"
  | "confirmNewPassword"
  | "enterCurrentPassword"
  | "enterNewPassword"
  | "confirmNewPasswordPlaceholder"
  | "changePassword"
  | "changingPassword"
  | "passwordChangeSuccess"
  | "passwordChangeFailed"
  | "twoFactorAuthentication"
  | "twoFactorEnabledDescription"
  | "twoFactorDisabledDescription"
  | "twoFactorPasswordAccountsOnly"
  | "twoFactorVerifyEmailFirst"
  | "twoFactorCode"
  | "twoFactorCodePlaceholder"
  | "twoFactorLoginSubtitle"
  | "twoFactorCodeSent"
  | "twoFactorCodeResent"
  | "twoFactorSetupCodeSent"
  | "twoFactorEnabledSuccess"
  | "twoFactorDisabledSuccess"
  | "twoFactorVerificationFailed"
  | "twoFactorResendFailed"
  | "twoFactorRequestFailed"
  | "twoFactorSetupFailed"
  | "twoFactorEnableFailed"
  | "twoFactorDisableFailed"
  | "enterSixDigitCode"
  | "verifyAndSignIn"
  | "resendCode"
  | "enableTwoFactor"
  | "confirmTwoFactor"
  | "disableTwoFactor"
  | "currentAndNewPasswordRequired"
  | "verifiedAccount"
  | "verifyEmailTitle"
  | "verifyingEmail"
  | "emailVerificationSuccess"
  | "emailVerificationInvalid"
  | "emailVerificationMissingToken"
  | "resendVerification"
  | "resendingVerification"
  | "verificationEmailSent"
  | "verificationEmailFailed"
  | "continueToThoughty";

export const securityTranslations: Record<Language, Record<SecurityTranslationKey, string>> = {
  en: {
    activeSessions: "Active sessions",
    activeSessionsDescription: "Review signed-in devices and end sessions you no longer use.",
    noActiveSessions: "No active sessions found.",
    session: "Session",
    sessionCreated: "Created",
    sessionExpires: "Expires",
    sessionAction: "Action",
    currentSession: "Current session",
    sessionNumber: "Session {id}",
    revoke: "Revoke",
    revoking: "Revoking...",
    signOutOtherSessions: "Sign out other sessions",
    sessionsLoadError: "Could not load active sessions.",
    sessionRevokeError: "Could not revoke the session. Please try again.",
    sessionRevoked: "Session revoked",
    otherSessionsRevoked: "Other sessions revoked",
    security: "Security",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmNewPassword: "Confirm New Password",
    enterCurrentPassword: "Enter your current password",
    enterNewPassword: "Enter your new password",
    confirmNewPasswordPlaceholder: "Confirm your new password",
    changePassword: "Change Password",
    changingPassword: "Changing...",
    passwordChangeSuccess: "Password changed successfully",
    passwordChangeFailed: "Failed to change password",
    twoFactorAuthentication: "Two-factor authentication",
    twoFactorEnabledDescription:
      "A code sent to your verified email is required when you sign in.",
    twoFactorDisabledDescription:
      "Add an email verification code after your password for stronger account security.",
    twoFactorPasswordAccountsOnly:
      "Email codes are available for password accounts only.",
    twoFactorVerifyEmailFirst:
      "Verify your email before enabling two-factor authentication.",
    twoFactorCode: "Verification code",
    twoFactorCodePlaceholder: "6-digit code",
    twoFactorLoginSubtitle: "Enter the code sent to your email",
    twoFactorCodeSent: "We sent a sign-in code to your email.",
    twoFactorCodeResent: "A new sign-in code was sent.",
    twoFactorSetupCodeSent: "Enter the code sent to your verified email.",
    twoFactorEnabledSuccess: "Two-factor authentication is enabled.",
    twoFactorDisabledSuccess: "Two-factor authentication is disabled.",
    twoFactorVerificationFailed:
      "The verification code could not be confirmed.",
    twoFactorResendFailed: "A new code could not be sent.",
    twoFactorRequestFailed: "The two-factor request failed.",
    twoFactorSetupFailed: "Two-factor setup could not start.",
    twoFactorEnableFailed: "Two-factor authentication could not be turned on.",
    twoFactorDisableFailed: "Two-factor authentication could not be turned off.",
    enterSixDigitCode: "Enter the 6-digit code.",
    verifyAndSignIn: "Verify and sign in",
    resendCode: "Resend code",
    enableTwoFactor: "Enable two-factor authentication",
    confirmTwoFactor: "Confirm and enable",
    disableTwoFactor: "Disable two-factor authentication",
    currentAndNewPasswordRequired: "Current and new password are required",
    verifiedAccount: "Verified",
    verifyEmailTitle: "Verify your email",
    verifyingEmail: "Verifying your email...",
    emailVerificationSuccess: "Your email is verified.",
    emailVerificationInvalid:
      "This verification link is invalid or has expired.",
    emailVerificationMissingToken: "This verification link is incomplete.",
    resendVerification: "Resend verification email",
    resendingVerification: "Sending...",
    verificationEmailSent: "Verification email sent.",
    verificationEmailFailed:
      "Could not send the verification email. Please try again.",
    continueToThoughty: "Continue to Thoughty",
  },
  fr: {
    activeSessions: "Sessions actives",
    activeSessionsDescription: "Consultez les appareils connectés et fermez les sessions que vous n'utilisez plus.",
    noActiveSessions: "Aucune session active.",
    session: "Session",
    sessionCreated: "Créée",
    sessionExpires: "Expire",
    sessionAction: "Action",
    currentSession: "Session actuelle",
    sessionNumber: "Session {id}",
    revoke: "Révoquer",
    revoking: "Révocation...",
    signOutOtherSessions: "Déconnecter les autres sessions",
    sessionsLoadError: "Impossible de charger les sessions actives.",
    sessionRevokeError: "Impossible de révoquer la session. Veuillez réessayer.",
    sessionRevoked: "Session révoquée",
    otherSessionsRevoked: "Autres sessions révoquées",
    security: "Sécurité",
    currentPassword: "Mot de passe actuel",
    newPassword: "Nouveau mot de passe",
    confirmNewPassword: "Confirmer le nouveau mot de passe",
    enterCurrentPassword: "Entrez votre mot de passe actuel",
    enterNewPassword: "Entrez votre nouveau mot de passe",
    confirmNewPasswordPlaceholder: "Confirmez votre nouveau mot de passe",
    changePassword: "Changer le mot de passe",
    changingPassword: "Modification...",
    passwordChangeSuccess: "Mot de passe modifié avec succès",
    passwordChangeFailed: "Échec de la modification du mot de passe",
    twoFactorAuthentication: "Authentification à deux facteurs",
    twoFactorEnabledDescription:
      "Un code envoyé à votre email vérifié est requis lors de la connexion.",
    twoFactorDisabledDescription:
      "Ajoutez un code de vérification par email après votre mot de passe.",
    twoFactorPasswordAccountsOnly:
      "Les codes par email sont réservés aux comptes avec mot de passe.",
    twoFactorVerifyEmailFirst:
      "Vérifiez votre email avant d'activer l'authentification à deux facteurs.",
    twoFactorCode: "Code de vérification",
    twoFactorCodePlaceholder: "Code à 6 chiffres",
    twoFactorLoginSubtitle: "Entrez le code envoyé à votre email",
    twoFactorCodeSent: "Un code de connexion a été envoyé à votre email.",
    twoFactorCodeResent: "Un nouveau code de connexion a été envoyé.",
    twoFactorSetupCodeSent: "Entrez le code envoyé à votre email vérifié.",
    twoFactorEnabledSuccess: "L'authentification à deux facteurs est activée.",
    twoFactorDisabledSuccess:
      "L'authentification à deux facteurs est désactivée.",
    twoFactorVerificationFailed:
      "Le code de vérification n'a pas pu être confirmé.",
    twoFactorResendFailed: "Le nouveau code n'a pas pu être envoyé.",
    twoFactorRequestFailed:
      "La demande d'authentification à deux facteurs a échoué.",
    twoFactorSetupFailed: "La configuration de l'authentification à deux facteurs n'a pas pu démarrer.",
    twoFactorEnableFailed: "L'authentification à deux facteurs n'a pas pu être activée.",
    twoFactorDisableFailed: "L'authentification à deux facteurs n'a pas pu être désactivée.",
    enterSixDigitCode: "Entrez le code à 6 chiffres.",
    verifyAndSignIn: "Vérifier et se connecter",
    resendCode: "Renvoyer le code",
    enableTwoFactor: "Activer l'authentification à deux facteurs",
    confirmTwoFactor: "Confirmer et activer",
    disableTwoFactor: "Désactiver l'authentification à deux facteurs",
    currentAndNewPasswordRequired:
      "Le mot de passe actuel et le nouveau sont requis",
    verifiedAccount: "Vérifié",
    verifyEmailTitle: "Vérifiez votre email",
    verifyingEmail: "Vérification de votre email...",
    emailVerificationSuccess: "Votre email est vérifié.",
    emailVerificationInvalid:
      "Ce lien de vérification n'est pas valide ou a expiré.",
    emailVerificationMissingToken: "Ce lien de vérification est incomplet.",
    resendVerification: "Renvoyer l'email de vérification",
    resendingVerification: "Envoi...",
    verificationEmailSent: "Email de vérification envoyé.",
    verificationEmailFailed:
      "Impossible d'envoyer l'email de vérification. Veuillez réessayer.",
    continueToThoughty: "Continuer vers Thoughty",
  },
};
