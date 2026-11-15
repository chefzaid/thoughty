import { Navigate, useSearchParams } from 'react-router-dom';

import FeedPage from '../components/FeedPage/FeedPage';
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
  readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * `/feed?view=leaderboard` shows the leaderboard; the feed itself is the default view. Quiet mode has no
 * leaderboard: no link to it, and its address shows the feed. While public sharing is switched off, the page
 * says so instead of asking for a feed the API refuses.
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
      onOpenLeaderboard={quiet ? undefined : () => setSearchParams({ view: 'leaderboard' })}
    />
  );
}

export default FeedRoute;
