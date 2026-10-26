import type { ComponentProps } from 'react';

import type AboutPage from '../components/AboutPage/AboutPage';
import type AuthPage from '../components/AuthPage/AuthPage';
import type BlogPage from '../components/BlogPage/BlogPage';
import type ContactPage from '../components/ContactPage/ContactPage';
import type FeedbackPage from '../components/FeedbackPage/FeedbackPage';
import type IntroPage from '../components/IntroPage/IntroPage';
import type LegalPage from '../components/LegalPage/LegalPage';
import type VerifyEmailPage from '../components/VerifyEmailPage/VerifyEmailPage';
import type { PublicViewType, TranslationFunction } from '../types';

export type IntroPageProps = ComponentProps<typeof IntroPage>;
export type AboutPageProps = ComponentProps<typeof AboutPage>;
export type BlogPageProps = ComponentProps<typeof BlogPage>;
export type ContactPageProps = ComponentProps<typeof ContactPage>;
export type FeedbackPageProps = ComponentProps<typeof FeedbackPage>;
export type AuthPageProps = ComponentProps<typeof AuthPage>;
export type LegalPageProps = ComponentProps<typeof LegalPage>;
export type VerifyEmailPageProps = ComponentProps<typeof VerifyEmailPage>;

type AppShellRoutingState = ReturnType<typeof import('../hooks/useAppShellRouting').useAppShellRouting>;

interface BuildPublicShellPropsParams {
  configTheme?: 'light' | 'dark';
  isAuthenticated?: boolean;
  publicView: PublicViewType | null;
  routingState: Pick<AppShellRoutingState, 'handleAuthSuccess' | 'handlePublicViewChange' | 'handleViewChange'>;
  t: TranslationFunction;
}

export function buildPublicShellProps({
  configTheme,
  isAuthenticated,
  publicView,
  routingState,
  t,
}: Readonly<BuildPublicShellPropsParams>) {
  const theme = configTheme || 'dark';

  const introPageProps: IntroPageProps = {
    theme,
    t,
    isAuthenticated,
    onOpenJournal: () => routingState.handleViewChange('journal'),
    onSignIn: () => routingState.handlePublicViewChange('login'),
    onSignUp: () => routingState.handlePublicViewChange('register'),
  };

  const aboutPageProps: AboutPageProps = {
    theme,
    t,
    onBackHome: () => routingState.handlePublicViewChange('intro'),
    onSignUp: () => routingState.handlePublicViewChange('register'),
  };

  const blogPageProps: BlogPageProps = {
    theme,
    t,
    onBackHome: () => routingState.handlePublicViewChange('intro'),
  };

  const contactPageProps: ContactPageProps = {
    theme,
    t,
    onBackHome: () => routingState.handlePublicViewChange('intro'),
  };

  const feedbackPageProps: FeedbackPageProps = {
    theme,
    t,
    onBackHome: () => routingState.handlePublicViewChange('intro'),
    onSignIn: () => routingState.handlePublicViewChange('login'),
  };

  const legalPageProps: Omit<LegalPageProps, 'page'> = {
    theme,
    t,
    onBackHome: () => routingState.handlePublicViewChange('intro'),
  };

  const authPageProps: AuthPageProps = {
    t,
    theme,
    mode: publicView === 'register' ? 'register' : 'login',
    onAuthSuccess: routingState.handleAuthSuccess,
    onModeChange: routingState.handlePublicViewChange,
    onBack: () => routingState.handlePublicViewChange('intro'),
  };

  const verifyEmailPageProps: VerifyEmailPageProps = {
    t,
    theme,
    onContinue: () => routingState.handlePublicViewChange('login'),
  };

  return {
    introPageProps,
    aboutPageProps,
    blogPageProps,
    contactPageProps,
    feedbackPageProps,
    legalPageProps,
    authPageProps,
    verifyEmailPageProps,
  };
}
