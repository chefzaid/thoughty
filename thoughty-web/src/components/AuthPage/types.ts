// AuthPage types and utilities

import type { TranslationFunction } from '../../types';
import { PASSWORD_SYMBOLS, isStrongPassword } from '../../utils/passwordRule';

export type { TranslationFunction };

export interface AuthResult {
  success: boolean;
  error?: string;
  twoFactorRequired?: boolean;
  challengeToken?: string;
  verificationRequired?: boolean;
}

export function isValidEmail(email: string): boolean {
  if (email.length > 254 || /\s/.test(email)) return false;
  const parts = email.split('@');
  if (parts.length !== 2 || !parts[0]) return false;
  const domain = parts[1] ?? '';
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1;
}

export const validateForgotPassword = ({ email, t }: { email: string; t: TranslationFunction }): string => {
  if (!email) return t('enterEmail');
  if (!isValidEmail(email)) return t('invalidEmail');
  return '';
};

export { PASSWORD_SYMBOLS, isStrongPassword };

/** A new password and its confirmation, checked as the API will check them. */
export const validateNewPassword = ({
  password,
  confirmPassword,
  t
}: {
  password: string;
  confirmPassword: string;
  t: TranslationFunction;
}): string => {
  if (!password) return t('enterNewPassword');
  if (!isStrongPassword(password)) return t('passwordTooWeak', { symbols: PASSWORD_SYMBOLS });
  if (!confirmPassword) return t('confirmPasswordPlaceholder');
  if (password !== confirmPassword) return t('passwordsDoNotMatch');
  return '';
};

export const validateLogin = ({ identifier, password, t }: { identifier: string; password: string; t: TranslationFunction }): string => {
  if (!identifier) return t('enterEmailOrUsername');
  if (!password) return t('enterPassword');
  return '';
};

export const validateRegister = ({
  username,
  email,
  password,
  confirmPassword,
  t
}: {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  t: TranslationFunction;
}): string => {
  const checks: [boolean, string][] = [
    [!username, t('enterUsername')],
    [!email, t('enterEmail')],
    [Boolean(email) && !isValidEmail(email), t('invalidEmail')],
    [!password, t('enterPassword')]
  ];
  const failedCheck = checks.find(([condition]) => condition);
  // The password and its confirmation, as the reset page and the API check a new one
  return failedCheck ? failedCheck[1] : validateNewPassword({ password, confirmPassword, t });
};

export interface ValidateAuthFormParams {
  showForgotPassword: boolean;
  isLogin: boolean;
  identifier: string;
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
  t: TranslationFunction;
}

export const validateAuthForm = ({
  showForgotPassword,
  isLogin,
  identifier,
  email,
  password,
  confirmPassword,
  username,
  t
}: ValidateAuthFormParams): string => {
  if (showForgotPassword) {
    return validateForgotPassword({ email, t });
  }
  if (isLogin) {
    return validateLogin({ identifier, password, t });
  }
  return validateRegister({ username, email, password, confirmPassword, t });
};

export const getAuthSubtitleText = ({
  showForgotPassword,
  isLogin,
  t
}: {
  showForgotPassword: boolean;
  isLogin: boolean;
  t: TranslationFunction;
}): string => {
  if (showForgotPassword) return t('resetYourPassword');
  return isLogin ? t('welcomeBack') : t('createAccount');
};
