import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';
import IntroPage from './components/IntroPage/IntroPage';
import { useAppShellModel } from './hooks/useAppShellModel';
import PublicAppLayout from './routes/PublicAppLayout';
import { getPathForView, getPublicPathForView } from './types';

const AboutPage = lazy(() => import('./components/AboutPage/AboutPage'));
const AuthPage = lazy(() => import('./components/AuthPage/AuthPage'));
const BlogPage = lazy(() => import('./components/BlogPage/BlogPage'));
const ContactPage = lazy(() => import('./components/ContactPage/ContactPage'));
const FeedbackPage = lazy(() => import('./components/FeedbackPage/FeedbackPage'));
const LegalPage = lazy(() => import('./components/LegalPage/LegalPage'));
const VerifyEmailPage = lazy(() => import('./components/VerifyEmailPage/VerifyEmailPage'));
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
    pathname,
    publicView,
    authPageProps,
    aboutPageProps,
    blogPageProps,
    contactPageProps,
    feedbackPageProps,
    legalPageProps,
    verifyEmailPageProps,
    authenticatedLayoutProps,
    authenticatedRoutesProps,
    introPageProps,
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

  if (publicView === 'privacy' || publicView === 'terms') {
    return renderPublic(renderLazy(<LegalPage {...legalPageProps} page={publicView} />), legalPageProps.t);
  }

  if (publicView === 'verifyEmail') {
    return renderPublic(renderLazy(<VerifyEmailPage {...verifyEmailPageProps} />), verifyEmailPageProps.t);
  }

  if (!isAuthenticated) {
    if (!publicView) {
      return <Navigate to={getPublicPathForView('intro')} replace />;
    }

    if (publicView === 'intro') {
      return renderPublic(<IntroPage {...introPageProps} />, introPageProps.t);
    }

    return renderPublic(renderLazy(<AuthPage {...authPageProps} />), authPageProps.t);
  }

  if (pathname === '/') {
    return <Navigate to={getPathForView('journal')} replace />;
  }

  if (!currentView) {
    return <Navigate to={getPathForView('journal')} replace />;
  }

  return renderLazy(
    <AuthenticatedAppLayout {...authenticatedLayoutProps}>
      <AuthenticatedRoutes {...authenticatedRoutesProps} />
    </AuthenticatedAppLayout>,
  );
}

export default AppShell;
