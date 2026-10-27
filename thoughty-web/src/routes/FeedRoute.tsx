import { useSearchParams } from 'react-router-dom';

import FeedPage from '../components/FeedPage/FeedPage';
import LeaderboardPage from '../components/FeedPage/LeaderboardPage';

interface FeedRouteProps {
  readonly theme?: 'light' | 'dark';
  readonly language?: string;
  readonly readDates?: boolean;
  readonly ttsVoiceUri?: string;
  readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/** `/feed?view=leaderboard` shows the leaderboard; the feed itself is the default view. */
function FeedRoute({ language, readDates, ttsVoiceUri, ...props }: Readonly<FeedRouteProps>) {
  const [searchParams, setSearchParams] = useSearchParams();

  if (searchParams.get('view') === 'leaderboard') {
    return <LeaderboardPage {...props} onBack={() => setSearchParams({})} />;
  }
  return (
    <FeedPage
      {...props}
      language={language}
      readDates={readDates}
      ttsVoiceUri={ttsVoiceUri}
      onOpenLeaderboard={() => setSearchParams({ view: 'leaderboard' })}
    />
  );
}

export default FeedRoute;
