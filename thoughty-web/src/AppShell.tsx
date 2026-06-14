import { Navigate } from 'react-router-dom';

import AboutPage from './components/AboutPage/AboutPage';
import AuthPage from './components/AuthPage/AuthPage';
import ContactPage from './components/ContactPage/ContactPage';
import FeedbackPage from './components/FeedbackPage/FeedbackPage';
import LegalPage from './components/LegalPage/LegalPage';
import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';
import IntroPage from './components/IntroPage/IntroPage';
import { useAppShellModel } from './hooks/useAppShellModel';
import AuthenticatedAppLayout from './routes/AuthenticatedAppLayout';
import AuthenticatedRoutes from './routes/AuthenticatedRoutes';
import { getPathForView, getPublicPathForView } from './types';

function AppShell() {
  const {
    authLoading,
    isAuthenticated,
    currentView,
    pathname,
    publicView,
    authPageProps,
    aboutPageProps,
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
    return <AboutPage {...aboutPageProps} />;
  }

  if (publicView === 'contact') {
    return <ContactPage {...contactPageProps} />;
  }

  if (publicView === 'feedback') {
    return <FeedbackPage {...feedbackPageProps} />;
  }

  if (publicView === 'privacy' || publicView === 'terms') {
    return <LegalPage {...legalPageProps} page={publicView} />;
  }

  if (!isAuthenticated) {
    if (!publicView) {
      return <Navigate to={getPublicPathForView('intro')} replace />;
    }

    if (publicView === 'intro') {
      return <IntroPage {...introPageProps} />;
    }

    return <AuthPage {...authPageProps} />;
  }

  if (pathname === '/') {
    return <Navigate to={getPathForView('journal')} replace />;
  }

  if (!currentView) {
    return <Navigate to={getPathForView('journal')} replace />;
  }

  return (
    <AuthenticatedAppLayout {...authenticatedLayoutProps}>
      <AuthenticatedRoutes {...authenticatedRoutesProps} />
    </AuthenticatedAppLayout>
  );
}

export default AppShell;
