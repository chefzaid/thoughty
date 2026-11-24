import type { ComponentProps } from 'react';

import type AboutPage from '../components/AboutPage/AboutPage';
import type AuthPage from '../components/AuthPage/AuthPage';
import type BlogPage from '../components/BlogPage/BlogPage';
import type CompleteSignUpPage from '../components/CompleteSignUpPage/CompleteSignUpPage';
import type ResetPasswordPage from '../components/ResetPasswordPage/ResetPasswordPage';
import type ContactPage from '../components/ContactPage/ContactPage';
import type FeedbackPage from '../components/FeedbackPage/FeedbackPage';
import type IntroPage from '../components/IntroPage/IntroPage';
import type JournalTemplatesPage from '../components/PublicLibrary/JournalTemplatesPage';
import type MemoirQuestionsPage from '../components/PublicLibrary/MemoirQuestionsPage';
import type LegalPage from '../components/LegalPage/LegalPage';
import type UnsubscribePage from '../components/UnsubscribePage/UnsubscribePage';
import type VerifyEmailPage from '../components/VerifyEmailPage/VerifyEmailPage';
import type SessionUnreachablePage from '../components/SessionUnreachable/SessionUnreachablePage';
import type AddEmailPage from '../components/AddEmailPage/AddEmailPage';
import type { PublicViewType, TranslationFunction, ViewType } from '../types';
import type { Language } from './translations';
import type { Theme } from './visitorPreferences';

export type IntroPageProps = ComponentProps<typeof IntroPage>;
export type AboutPageProps = ComponentProps<typeof AboutPage>;
export type BlogPageProps = ComponentProps<typeof BlogPage>;
export type ContactPageProps = ComponentProps<typeof ContactPage>;
export type FeedbackPageProps = ComponentProps<typeof FeedbackPage>;
export type MemoirQuestionsPageProps = ComponentProps<typeof MemoirQuestionsPage>;
export type JournalTemplatesPageProps = ComponentProps<typeof JournalTemplatesPage>;
export type AuthPageProps = ComponentProps<typeof AuthPage>;
export type LegalPageProps = ComponentProps<typeof LegalPage>;
export type VerifyEmailPageProps = ComponentProps<typeof VerifyEmailPage>;
export type CompleteSignUpPageProps = ComponentProps<typeof CompleteSignUpPage>;
export type ResetPasswordPageProps = ComponentProps<typeof ResetPasswordPage>;
export type UnsubscribePageProps = ComponentProps<typeof UnsubscribePage>;
export type SessionUnreachablePageProps = ComponentProps<typeof SessionUnreachablePage>;
export type AddEmailPageProps = ComponentProps<typeof AddEmailPage>;

type AppShellRoutingState = ReturnType<typeof import('../hooks/useAppShellRouting').useAppShellRouting>;

interface BuildPublicShellPropsParams {
  /** The writer's theme and language, or for a visitor the browser's (or what they picked on the public pages). */
  theme: Theme;
  language: Language;
  isAuthenticated?: boolean;
  /** Where a signed-in writer goes from the presentation page; the journal while the settings load. */
  landingView?: ViewType | null;
  publicView: PublicViewType | null;
  routingState: Pick<AppShellRoutingState, 'handleAuthSuccess' | 'handlePublicViewChange' | 'handleViewChange'>;
  t: TranslationFunction;
}

export function buildPublicShellProps({
  theme,
  language,
  isAuthenticated,
  landingView,
  publicView,
  routingState,
  t,
}: Readonly<BuildPublicShellPropsParams>) {
  const introPageProps: IntroPageProps = {
    theme,
    t,
    isAuthenticated,
    onOpenJournal: () => routingState.handleViewChange(landingView ?? 'journal'),
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
    onOpenFeedback: () => routingState.handlePublicViewChange('feedback'),
  };

  const feedbackPageProps: FeedbackPageProps = {
    theme,
    t,
    onBackHome: () => routingState.handlePublicViewChange('intro'),
    onSignIn: () => routingState.handlePublicViewChange('login'),
  };

  const memoirQuestionsPageProps: MemoirQuestionsPageProps = {
    theme,
    t,
    language,
    isAuthenticated,
    onSignUp: () => routingState.handlePublicViewChange('register'),
    onOpenMemoir: () => routingState.handleViewChange('memoir'),
    onBackHome: () => routingState.handlePublicViewChange('intro'),
  };

  const journalTemplatesPageProps: JournalTemplatesPageProps = {
    theme,
    t,
    language,
    isAuthenticated,
    onSignUp: () => routingState.handlePublicViewChange('register'),
    onOpenJournal: () => routingState.handleViewChange('journal'),
    onBackHome: () => routingState.handlePublicViewChange('intro'),
  };

  const legalPageProps: Omit<LegalPageProps, 'page'> = {
    theme,
    t,
    onBackHome: () => routingState.handlePublicViewChange('intro'),
  };

  const authPageProps: AuthPageProps = {
    t,
    theme,
    language,
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

  const completeSignUpPageProps: CompleteSignUpPageProps = {
    t,
    theme,
    // The account was just created, so it starts on the welcome page that asks what it is here for
    onComplete: () => {
      routingState.handleAuthSuccess();
      routingState.handleViewChange('welcome');
    },
    onSignUp: () => routingState.handlePublicViewChange('register'),
    onSignIn: () => routingState.handlePublicViewChange('login'),
  };

  const resetPasswordPageProps: ResetPasswordPageProps = {
    t,
    theme,
    onSignIn: () => routingState.handlePublicViewChange('login'),
  };

  const unsubscribePageProps: UnsubscribePageProps = {
    t,
    theme,
    onContinue: () => routingState.handlePublicViewChange('intro'),
  };

  return {
    introPageProps,
    aboutPageProps,
    blogPageProps,
    contactPageProps,
    feedbackPageProps,
    memoirQuestionsPageProps,
    journalTemplatesPageProps,
    legalPageProps,
    authPageProps,
    verifyEmailPageProps,
    completeSignUpPageProps,
    resetPasswordPageProps,
    unsubscribePageProps,
  };
}
