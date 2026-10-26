import type { Language } from './translations';

/** Sign-in, sign-up, password reset, the account menu and account deletion. */
export type AuthTranslationKey =
  | "user"
  | "logout"
  | "profile"
  | "back"
  | "signIn"
  | "signUp"
  | "welcomeBack"
  | "createAccount"
  | "resetYourPassword"
  | "password"
  | "confirmPassword"
  | "username"
  | "emailOrUsername"
  | "enterEmail"
  | "enterEmailOrUsername"
  | "enterPassword"
  | "enterUsername"
  | "confirmPasswordPlaceholder"
  | "showPassword"
  | "hidePassword"
  | "orContinueWith"
  | "continueWithKeycloak"
  | "keycloakSignInFailed"
  | "continueWithGoogle"
  | "dontHaveAccount"
  | "alreadyHaveAccount"
  | "invalidEmail"
  | "passwordMinLength"
  | "passwordsDoNotMatch"
  | "authFailed"
  | "googleSignInFailed"
  | "googleSignInUnavailable"
  | "serverUnavailable"
  | "forgotPassword"
  | "sendResetLink"
  | "backToLogin"
  | "resetEmailSent"
  | "forgotPasswordFailed"
  | "deleteAccount"
  | "deleteAccountDescription"
  | "deleteAccountWarning"
  | "typeDeleteToConfirm"
  | "enterYourPassword"
  | "confirmDelete"
  | "deleteAccountFailed"
  | "passwordRequired";

export const authTranslations: Record<Language, Record<AuthTranslationKey, string>> = {
  en: {
    user: "User",
    logout: "Logout",
    profile: "Profile",
    back: "Back",
    signIn: "Sign In",
    signUp: "Sign Up",
    welcomeBack: "Welcome back",
    createAccount: "Create your account",
    resetYourPassword: "Reset your password",
    password: "Password",
    confirmPassword: "Confirm Password",
    username: "Username",
    emailOrUsername: "Email or Username",
    enterEmail: "Enter your email",
    enterEmailOrUsername: "Enter your email or username",
    enterPassword: "Enter your password",
    enterUsername: "Choose a username",
    confirmPasswordPlaceholder: "Confirm your password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    orContinueWith: "or continue with",
    continueWithKeycloak: "Continue with Keycloak",
    keycloakSignInFailed: "Keycloak sign-in did not complete. Try again, or sign in with your Thoughty email and password.",
    continueWithGoogle: "Continue with Google",
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: "Already have an account?",
    invalidEmail: "Please enter a valid email address",
    passwordMinLength: "Password must be at least 6 characters",
    passwordsDoNotMatch: "Passwords do not match",
    authFailed: "Authentication failed. Please try again.",
    googleSignInFailed: "Google sign-in failed. Please try again.",
    googleSignInUnavailable: "Google sign-in is not available.",
    serverUnavailable: "The server is unavailable. Please try again later.",
    forgotPassword: "Forgot password?",
    sendResetLink: "Send Reset Link",
    backToLogin: "Back to Login",
    resetEmailSent:
      "If an account exists with this email, a reset link will be sent.",
    forgotPasswordFailed: "Failed to send reset email. Please try again.",
    deleteAccount: "Delete Account",
    deleteAccountDescription:
      "Permanently delete your account and all associated data",
    deleteAccountWarning:
      "This action cannot be undone. You will be signed out right away, and your account, entries, attachments, and all other data will be permanently deleted within 30 days.",
    typeDeleteToConfirm: "Type DELETE to confirm",
    enterYourPassword: "Enter your password",
    confirmDelete: "Confirm Delete",
    deleteAccountFailed: "Failed to delete account. Please try again.",
    passwordRequired: "Password is required",
  },
  fr: {
    user: "Utilisateur",
    logout: "Déconnexion",
    profile: "Profil",
    back: "Retour",
    signIn: "Se connecter",
    signUp: "S'inscrire",
    welcomeBack: "Bon retour",
    createAccount: "Créez votre compte",
    resetYourPassword: "Réinitialiser votre mot de passe",
    password: "Mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    username: "Nom d'utilisateur",
    emailOrUsername: "Email ou nom d'utilisateur",
    enterEmail: "Entrez votre email",
    enterEmailOrUsername: "Entrez votre email ou nom d'utilisateur",
    enterPassword: "Entrez votre mot de passe",
    enterUsername: "Choisissez un nom d'utilisateur",
    confirmPasswordPlaceholder: "Confirmez votre mot de passe",
    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",
    orContinueWith: "ou continuer avec",
    continueWithKeycloak: "Continuer avec Keycloak",
    keycloakSignInFailed: "La connexion avec Keycloak n'a pas abouti. Réessayez, ou connectez-vous avec votre e-mail et votre mot de passe Thoughty.",
    continueWithGoogle: "Continuer avec Google",
    dontHaveAccount: "Vous n'avez pas de compte ?",
    alreadyHaveAccount: "Vous avez déjà un compte ?",
    invalidEmail: "Veuillez entrer une adresse email valide",
    passwordMinLength: "Le mot de passe doit contenir au moins 6 caractères",
    passwordsDoNotMatch: "Les mots de passe ne correspondent pas",
    authFailed: "Échec de l'authentification. Veuillez réessayer.",
    googleSignInFailed: "Échec de la connexion Google. Veuillez réessayer.",
    googleSignInUnavailable: "La connexion Google n'est pas disponible.",
    serverUnavailable: "Le serveur est indisponible. Veuillez réessayer plus tard.",
    forgotPassword: "Mot de passe oublié ?",
    sendResetLink: "Envoyer le lien de réinitialisation",
    backToLogin: "Retour à la connexion",
    resetEmailSent:
      "Si un compte existe avec cet email, un lien de réinitialisation sera envoyé.",
    forgotPasswordFailed:
      "Échec de l'envoi de l'email de réinitialisation. Veuillez réessayer.",
    deleteAccount: "Supprimer le compte",
    deleteAccountDescription:
      "Supprimer définitivement votre compte et toutes les données associées",
    deleteAccountWarning:
      "Cette action est irréversible. Vous serez déconnecté immédiatement, et votre compte, vos entrées, vos pièces jointes et toutes vos autres données seront supprimés définitivement sous 30 jours.",
    typeDeleteToConfirm: "Tapez DELETE pour confirmer",
    enterYourPassword: "Entrez votre mot de passe",
    confirmDelete: "Confirmer la suppression",
    deleteAccountFailed:
      "Échec de la suppression du compte. Veuillez réessayer.",
    passwordRequired: "Le mot de passe est requis",
  },
};
