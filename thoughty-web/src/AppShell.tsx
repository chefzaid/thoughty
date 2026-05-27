import { Navigate } from 'react-router-dom';

import AuthPage from './components/AuthPage/AuthPage';
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
    authenticatedLayoutProps,
    authenticatedRoutesProps,
    introPageProps,
  } = useAppShellModel();

  if (authLoading) {
    return <LoadingSpinner />;
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