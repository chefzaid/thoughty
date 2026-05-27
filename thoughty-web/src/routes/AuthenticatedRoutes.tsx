import type { ComponentProps } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { getPathForView } from '../types';
import DiariesRoute from './DiariesRoute';
import ImportExportRoute from './ImportExportRoute';
import JournalRoute from './JournalRoute';
import ProfileRoute from './ProfileRoute';
import StatsRoute from './StatsRoute';
import TagManagerRoute from './TagManagerRoute';

interface AuthenticatedRoutesProps {
  diariesRouteProps: ComponentProps<typeof DiariesRoute>;
  importExportRouteProps: ComponentProps<typeof ImportExportRoute>;
  journalRouteProps: ComponentProps<typeof JournalRoute>;
  profileRouteProps: ComponentProps<typeof ProfileRoute>;
  statsRouteProps: ComponentProps<typeof StatsRoute>;
  tagManagerRouteProps: ComponentProps<typeof TagManagerRoute>;
}

function AuthenticatedRoutes({
  diariesRouteProps,
  importExportRouteProps,
  journalRouteProps,
  profileRouteProps,
  statsRouteProps,
  tagManagerRouteProps,
}: Readonly<AuthenticatedRoutesProps>) {
  return (
    <Routes>
      <Route path={getPathForView('profile')} element={<ProfileRoute {...profileRouteProps} />} />
      <Route path={getPathForView('tags')} element={<TagManagerRoute {...tagManagerRouteProps} />} />
      <Route path={getPathForView('diaries')} element={<DiariesRoute {...diariesRouteProps} />} />
      <Route path={getPathForView('stats')} element={<StatsRoute {...statsRouteProps} />} />
      <Route path={getPathForView('importExport')} element={<ImportExportRoute {...importExportRouteProps} />} />
      <Route path={getPathForView('journal')} element={<JournalRoute {...journalRouteProps} />} />
      <Route path="*" element={<Navigate to={getPathForView('journal')} replace />} />
    </Routes>
  );
}

export default AuthenticatedRoutes;