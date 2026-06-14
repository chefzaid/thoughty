import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';
import IntroPage from './components/IntroPage/IntroPage';
import { useAppShellModel } from './hooks/useAppShellModel';
import { getPathForView, getPublicPathForView } from './types';

const AboutPage = lazy(() => import('./components/AboutPage/AboutPage'));
const AuthPage = lazy(() => import('./components/AuthPage/AuthPage'));
const BlogPage = lazy(() => import('./components/BlogPage/BlogPage'));
const ContactPage = lazy(() => import('./components/ContactPage/ContactPage'));
const FeedbackPage = lazy(() => import('./components/FeedbackPage/FeedbackPage'));
const LegalPage = lazy(() => import('./components/LegalPage/LegalPage'));
const AuthenticatedAppLayout = lazy(() => import('./routes/AuthenticatedAppLayout'));
const AuthenticatedRoutes = lazy(() => import('./routes/AuthenticatedRoutes'));

function renderLazy(children: ReactNode) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      {children}
    </Suspense>
  );
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
    authenticatedLayoutProps,
    authenticatedRoutesProps,
    introPageProps,
  } = useAppShellModel();

  if (authLoading) {
    return <LoadingSpinner />;
  }

  if (publicView === 'about') {
    return renderLazy(<AboutPage {...aboutPageProps} />);
  }

  if (publicView === 'blog') {
    return renderLazy(<BlogPage {...blogPageProps} />);
  }

  if (publicView === 'contact') {
    return renderLazy(<ContactPage {...contactPageProps} />);
  }

  if (publicView === 'feedback') {
    return renderLazy(<FeedbackPage {...feedbackPageProps} />);
  }

  if (publicView === 'privacy' || publicView === 'terms') {
    return renderLazy(<LegalPage {...legalPageProps} page={publicView} />);
  }

  if (!isAuthenticated) {
    if (!publicView) {
      return <Navigate to={getPublicPathForView('intro')} replace />;
    }

    if (publicView === 'intro') {
      return <IntroPage {...introPageProps} />;
    }

    return renderLazy(<AuthPage {...authPageProps} />);
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
