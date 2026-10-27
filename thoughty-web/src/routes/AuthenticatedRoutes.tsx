import type { ComponentProps } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { getPathForView } from '../types';
import DiariesRoute from './DiariesRoute';
import FeedRoute from './FeedRoute';
import ImportExportRoute from './ImportExportRoute';
import JournalRoute from './JournalRoute';
import MemoirRoute from './MemoirRoute';
import PeopleRoute from './PeopleRoute';
import ProfileRoute from './ProfileRoute';
import RecycleBinRoute from './RecycleBinRoute';
import ReviewRoute from './ReviewRoute';
import StatsRoute from './StatsRoute';
import TagManagerRoute from './TagManagerRoute';

interface AuthenticatedRoutesProps {
  diariesRouteProps: ComponentProps<typeof DiariesRoute>;
  feedRouteProps: ComponentProps<typeof FeedRoute>;
  importExportRouteProps: ComponentProps<typeof ImportExportRoute>;
  journalRouteProps: ComponentProps<typeof JournalRoute>;
  memoirRouteProps: ComponentProps<typeof MemoirRoute>;
  peopleRouteProps: ComponentProps<typeof PeopleRoute>;
  profileRouteProps: ComponentProps<typeof ProfileRoute>;
  recycleBinRouteProps: ComponentProps<typeof RecycleBinRoute>;
  reviewRouteProps: ComponentProps<typeof ReviewRoute>;
  statsRouteProps: ComponentProps<typeof StatsRoute>;
  tagManagerRouteProps: ComponentProps<typeof TagManagerRoute>;
}

function AuthenticatedRoutes({
  diariesRouteProps,
  feedRouteProps,
  importExportRouteProps,
  journalRouteProps,
  memoirRouteProps,
  peopleRouteProps,
  profileRouteProps,
  recycleBinRouteProps,
  reviewRouteProps,
  statsRouteProps,
  tagManagerRouteProps,
}: Readonly<AuthenticatedRoutesProps>) {
  return (
    <Routes>
      <Route path={getPathForView('profile')} element={<ProfileRoute {...profileRouteProps} />} />
      <Route path={getPathForView('tags')} element={<TagManagerRoute {...tagManagerRouteProps} />} />
      <Route path={getPathForView('people')} element={<PeopleRoute {...peopleRouteProps} />} />
      <Route path={getPathForView('diaries')} element={<DiariesRoute {...diariesRouteProps} />} />
      <Route path={getPathForView('feed')} element={<FeedRoute {...feedRouteProps} />} />
      <Route path={getPathForView('memoir')} element={<MemoirRoute {...memoirRouteProps} />} />
      <Route path={getPathForView('stats')} element={<StatsRoute {...statsRouteProps} />} />
      <Route path={getPathForView('review')} element={<ReviewRoute {...reviewRouteProps} />} />
      <Route path={getPathForView('recycleBin')} element={<RecycleBinRoute {...recycleBinRouteProps} />} />
      <Route path={getPathForView('importExport')} element={<ImportExportRoute {...importExportRouteProps} />} />
      <Route path={getPathForView('journal')} element={<JournalRoute {...journalRouteProps} />} />
      <Route path="*" element={<Navigate to={getPathForView('journal')} replace />} />
    </Routes>
  );
}

export default AuthenticatedRoutes;
