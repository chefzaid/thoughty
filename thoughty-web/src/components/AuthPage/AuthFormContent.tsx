import React from 'react';
import type { TranslationFunction } from './types';
import ForgotPasswordForm from './ForgotPasswordForm';
import LoginRegisterForm from './LoginRegisterForm';

interface AuthFormContentProps {
  showForgotPassword: boolean;
  isLogin: boolean;
  isDark: boolean;
  t: TranslationFunction;
  loading: boolean;
  identifier: string;
  setIdentifier: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  username: string;
  setUsername: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  handleForgotPassword: () => void;
  handleBackToLogin: () => void;
}

const AuthFormContent: React.FC<AuthFormContentProps> = ({
  showForgotPassword,
  handleBackToLogin,
  email,
  setEmail,
  isDark,
  t,
  loading,
  ...loginRegisterProps
}) =>
  showForgotPassword ? (
    <ForgotPasswordForm
      email={email}
      setEmail={setEmail}
      isDark={isDark}
      t={t}
      loading={loading}
      handleBackToLogin={handleBackToLogin}
    />
  ) : (
    <LoginRegisterForm
      email={email}
      setEmail={setEmail}
      isDark={isDark}
      t={t}
      loading={loading}
      {...loginRegisterProps}
    />
  );

export default AuthFormContent;
