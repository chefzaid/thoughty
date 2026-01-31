// AuthPage types and utilities

export type TranslationFunction = (key: string, params?: Record<string, string | number>) => string;

export interface AuthResult {
  success: boolean;
  error?: string;
}

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateForgotPassword = ({ email, t }: { email: string; t: TranslationFunction }): string => {
  if (!email) return t('enterEmail');
  if (!emailRegex.test(email)) return t('invalidEmail');
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
    [Boolean(email) && !emailRegex.test(email), t('invalidEmail')],
    [!password, t('enterPassword')],
    [!confirmPassword, t('confirmPasswordPlaceholder')],
    [Boolean(password) && Boolean(confirmPassword) && password !== confirmPassword, t('passwordsDoNotMatch')]
  ];
  const failedCheck = checks.find(([condition]) => condition);
  return failedCheck ? failedCheck[1] : '';
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
