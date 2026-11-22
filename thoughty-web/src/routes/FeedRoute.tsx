import { Navigate, useSearchParams } from 'react-router-dom';

import FeedPage from '../components/FeedPage/FeedPage';
import type { PublicFeedEntry, PublicFeedFilters } from '../services/api';
import LeaderboardPage from '../components/FeedPage/LeaderboardPage';
import { useQuietMode } from '../components/QuietMode/quietMode';
import { getPathForView } from '../types';
import PageHeader from '../components/PageHeader/PageHeader';
import FeatureOffNote from '../components/FeatureFlags/FeatureOffNote';
import { useFeatureFlag } from '../components/FeatureFlags/featureFlags';

interface FeedRouteProps {
  readonly theme?: 'light' | 'dark';
  readonly language?: string;
  readonly readDates?: boolean;
  readonly ttsVoiceUri?: string;
  /** **Write about this** on another writer's entry: opens the journal's composer on a quote of it. */
  readonly onWriteAbout?: (entry: PublicFeedEntry) => void;
  readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/** The address of a feed narrowed to a topic (`?tag=gratitude`) and a word search (`?search=walk`). */
function feedFilterParams({ tag, search }: PublicFeedFilters): Record<string, string> {
  return {
    ...(tag ? { tag } : {}),
    ...(search ? { search } : {}),
  };
}

/** `?entry=42`: one entry, where a notification leads; anything but a positive whole number is ignored. */
function entryParam(value: string | null): number | undefined {
  const id = Number(value);
  return value && Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

/**
 * `/feed?view=leaderboard` shows the leaderboard; the feed itself is the default view, narrowed by `?tag=`
 * and `?search=` in the address, or showing the one entry of `?entry=`, so a topic can be linked to and Back
 * returns to the previous one. Quiet mode has no leaderboard: no link to it, and its address shows the feed.
 * While public sharing is switched off, the page says so instead of asking for a feed the API refuses.
 */
function FeedRoute({ language, readDates, ttsVoiceUri, ...props }: Readonly<FeedRouteProps>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const quiet = useQuietMode();
  const publicSharing = useFeatureFlag('publicSharing');

  if (!publicSharing) {
    return (
      <section className={`feed-page ${props.theme ?? 'dark'}`}>
        <PageHeader title={props.t('feed')} theme={props.theme} />
        <FeatureOffNote message="featureOffPublicSharing" theme={props.theme} t={props.t} />
      </section>
    );
  }
  if (searchParams.get('view') === 'leaderboard') {
    return quiet
      ? <Navigate to={getPathForView('feed')} replace />
      : <LeaderboardPage {...props} onBack={() => setSearchParams({})} />;
  }
  return (
    <FeedPage
      {...props}
      language={language}
      readDates={readDates}
      ttsVoiceUri={ttsVoiceUri}
      filters={{
        tag: searchParams.get('tag')?.trim() || undefined,
        search: searchParams.get('search')?.trim() || undefined,
        entry: entryParam(searchParams.get('entry')),
      }}
      onFiltersChange={(filters) => setSearchParams(feedFilterParams(filters))}
      onOpenLeaderboard={quiet ? undefined : () => setSearchParams({ view: 'leaderboard' })}
    />
  );
}

export default FeedRoute;
