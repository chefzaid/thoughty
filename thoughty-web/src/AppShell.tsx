import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';
import { DiaryAiContext } from './components/DiaryAi/diaryAiScope';
import AiConsentDialog from './components/DiaryAi/AiConsentDialog';
import NotificationsMenu from './components/Notifications/NotificationsMenu';
import IntroPage from './components/IntroPage/IntroPage';
import { useAppShellModel } from './hooks/useAppShellModel';
import PublicAppLayout from './routes/PublicAppLayout';
import { getPathForView, getPublicPathForView } from './types';

const AboutPage = lazy(() => import('./components/AboutPage/AboutPage'));
const AuthPage = lazy(() => import('./components/AuthPage/AuthPage'));
const BlogPage = lazy(() => import('./components/BlogPage/BlogPage'));
const ContactPage = lazy(() => import('./components/ContactPage/ContactPage'));
const FeedbackPage = lazy(() => import('./components/FeedbackPage/FeedbackPage'));
const MemoirQuestionsPage = lazy(() => import('./components/PublicLibrary/MemoirQuestionsPage'));
const JournalTemplatesPage = lazy(() => import('./components/PublicLibrary/JournalTemplatesPage'));
const LegalPage = lazy(() => import('./components/LegalPage/LegalPage'));
const VerifyEmailPage = lazy(() => import('./components/VerifyEmailPage/VerifyEmailPage'));
const CompleteSignUpPage = lazy(() => import('./components/CompleteSignUpPage/CompleteSignUpPage'));
const ResetPasswordPage = lazy(() => import('./components/ResetPasswordPage/ResetPasswordPage'));
const UnsubscribePage = lazy(() => import('./components/UnsubscribePage/UnsubscribePage'));
const SessionUnreachablePage = lazy(() => import('./components/SessionUnreachable/SessionUnreachablePage'));
const AuthenticatedAppLayout = lazy(() => import('./routes/AuthenticatedAppLayout'));
const AuthenticatedRoutes = lazy(() => import('./routes/AuthenticatedRoutes'));

function renderLazy(children: ReactNode) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      {children}
    </Suspense>
  );
}

function renderPublic(children: ReactNode, t: (key: string) => string) {
  return <PublicAppLayout t={t}>{children}</PublicAppLayout>;
}

function AppShell() {
  const {
    authLoading,
    isAuthenticated,
    currentView,
    landingView,
    publicView,
    authPageProps,
    aboutPageProps,
    blogPageProps,
    contactPageProps,
    feedbackPageProps,
    memoirQuestionsPageProps,
    journalTemplatesPageProps,
    legalPageProps,
    verifyEmailPageProps,
    completeSignUpPageProps,
    resetPasswordPageProps,
    unsubscribePageProps,
    authenticatedLayoutProps,
    authenticatedRoutesProps,
    introPageProps,
    sessionUnreachablePageProps,
    diaries,
    aiConsent,
  } = useAppShellModel();

  if (authLoading) {
    return <LoadingSpinner />;
  }

  if (publicView === 'about') {
    return renderPublic(renderLazy(<AboutPage {...aboutPageProps} />), aboutPageProps.t);
  }

  if (publicView === 'blog') {
    return renderPublic(renderLazy(<BlogPage {...blogPageProps} />), blogPageProps.t);
  }

  if (publicView === 'contact') {
    return renderPublic(renderLazy(<ContactPage {...contactPageProps} />), contactPageProps.t);
  }

  if (publicView === 'feedback') {
    return renderPublic(renderLazy(<FeedbackPage {...feedbackPageProps} />), feedbackPageProps.t);
  }

  if (publicView === 'memoirQuestions') {
    return renderPublic(renderLazy(<MemoirQuestionsPage {...memoirQuestionsPageProps} />), memoirQuestionsPageProps.t);
  }

  if (publicView === 'journalTemplates') {
    return renderPublic(renderLazy(<JournalTemplatesPage {...journalTemplatesPageProps} />), journalTemplatesPageProps.t);
  }

  if (publicView === 'privacy' || publicView === 'terms') {
    return renderPublic(renderLazy(<LegalPage {...legalPageProps} page={publicView} />), legalPageProps.t);
  }

  if (publicView === 'verifyEmail') {
    return renderPublic(renderLazy(<VerifyEmailPage {...verifyEmailPageProps} />), verifyEmailPageProps.t);
  }

  if (publicView === 'completeSignUp') {
    return renderPublic(renderLazy(<CompleteSignUpPage {...completeSignUpPageProps} />), completeSignUpPageProps.t);
  }

  if (publicView === 'resetPassword') {
    return renderPublic(renderLazy(<ResetPasswordPage {...resetPasswordPageProps} />), resetPasswordPageProps.t);
  }

  if (publicView === 'unsubscribe') {
    return renderPublic(renderLazy(<UnsubscribePage {...unsubscribePageProps} />), unsubscribePageProps.t);
  }

  // The presentation page stays the entry point for everyone; signed-in visitors open the journal from it.
  if (publicView === 'intro') {
    return renderPublic(<IntroPage {...introPageProps} />, introPageProps.t);
  }

  if (!isAuthenticated) {
    // Signed in, but Thoughty could not say as whom yet: not a sign-in page for a writer who is signed in
    if (sessionUnreachablePageProps) {
      return renderPublic(renderLazy(<SessionUnreachablePage {...sessionUnreachablePageProps} />), sessionUnreachablePageProps.t);
    }

    if (!publicView) {
      return <Navigate to={getPublicPathForView('intro')} replace />;
    }

    return renderPublic(renderLazy(<AuthPage {...authPageProps} />), authPageProps.t);
  }

  // Signing in lands in the journal, or in simple memoir mode once the settings say so
  if (!currentView) {
    return landingView ? <Navigate to={getPathForView(landingView)} replace /> : <LoadingSpinner />;
  }

  return renderLazy(
    <DiaryAiContext.Provider value={diaries}>
      <AuthenticatedAppLayout
        {...authenticatedLayoutProps}
        notifications={<NotificationsMenu language={authenticatedLayoutProps.config.language} t={authenticatedLayoutProps.t} />}
      >
        <AuthenticatedRoutes {...authenticatedRoutesProps} />
      </AuthenticatedAppLayout>
      <AiConsentDialog
        request={aiConsent.request}
        config={authenticatedLayoutProps.config}
        onAnswer={aiConsent.answer}
        t={authenticatedLayoutProps.t}
      />
    </DiaryAiContext.Provider>,
  );
}

export default AppShell;
