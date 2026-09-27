import { useEffect, useState } from 'react';

import { useFeedService } from '../../hooks/useFeedService';
import type { Leaderboard, LeaderboardPeriod } from '../../services/api';
import { FeedAvatar } from './FeedAuthor';
import './FeedPage.css';
import './LeaderboardPage.css';

type Translate = (key: string, params?: Record<string, string | number>) => string;
type EntryRank = Leaderboard['mostLikedEntries'][number];

const PERIODS: ReadonlyArray<{ period: LeaderboardPeriod; label: string }> = [
  { period: 'week', label: 'leaderboardWeek' },
  { period: 'month', label: 'leaderboardMonth' },
  { period: 'year', label: 'leaderboardYear' },
  { period: 'all', label: 'leaderboardAllTime' },
];

interface EntryRankingProps {
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  readonly countKey: string;
  readonly entries: readonly EntryRank[];
  readonly t: Translate;
}

function EntryRanking({ id, title, icon, countKey, entries, t }: EntryRankingProps) {
  return (
    <section className="leaderboard-section" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {entries.length === 0 ? (
        <p className="leaderboard-empty">{t('leaderboardEmpty')}</p>
      ) : (
        <ol className="leaderboard-list">
          {entries.map((entry) => (
            <li key={entry.id} className="leaderboard-entry">
              <p className="leaderboard-excerpt">{entry.excerpt}</p>
              <p className="leaderboard-meta">
                <FeedAvatar author={entry.author} />
                <strong>{entry.author.username}</strong>
                <time dateTime={entry.date}>{entry.date}</time>
                <span className="leaderboard-count">
                  <span className={`codicon codicon-${icon}`} aria-hidden="true" />
                  {t(countKey, { count: entry.count })}
                </span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

interface LeaderboardPageProps {
  readonly theme?: 'light' | 'dark';
  readonly onBack: () => void;
  readonly t: Translate;
}

function LeaderboardPage({ theme = 'dark', onBack, t }: LeaderboardPageProps) {
  const feedService = useFeedService();
  const [period, setPeriod] = useState<LeaderboardPeriod>('month');
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLeaderboard(null);
    setError(false);
    void feedService.fetchLeaderboard(period).then((result) => {
      if (!active) return;
      setLeaderboard(result.data);
      setError(!result.data);
    });
    return () => {
      active = false;
    };
  }, [feedService, period, attempt]);

  return (
    <section className={`feed-page leaderboard-page ${theme}`} aria-labelledby="leaderboard-heading">
      <header className="feed-header">
        <div className="leaderboard-title">
          <button type="button" className="leaderboard-back" onClick={onBack}>
            <span className="codicon codicon-arrow-left" aria-hidden="true" />
            {t('backToFeed')}
          </button>
          <h1 id="leaderboard-heading">{t('leaderboard')}</h1>
        </div>
        <fieldset className="feed-scope leaderboard-periods" aria-label={t('leaderboardPeriod')}>
          {PERIODS.map((option) => (
            <button
              key={option.period}
              type="button"
              className={period === option.period ? 'active' : ''}
              aria-pressed={period === option.period}
              onClick={() => setPeriod(option.period)}
            >
              {t(option.label)}
            </button>
          ))}
        </fieldset>
      </header>
      <p className="leaderboard-note">{t('leaderboardNote')}</p>

      {!leaderboard && !error && (
        <output className="feed-state">
          <span className="codicon codicon-loading codicon-modifier-spin" aria-hidden="true" /> {t('loading')}
        </output>
      )}
      {error && (
        <div className="feed-state error" role="alert">
          <p>{t('leaderboardLoadError')}</p>
          <button type="button" onClick={() => setAttempt((current) => current + 1)}>
            <span className="codicon codicon-refresh" aria-hidden="true" /> {t('tryAgain')}
          </button>
        </div>
      )}
      {leaderboard && (
        <div className="leaderboard-grid">
          <section className="leaderboard-section" aria-labelledby="leaderboard-authors">
            <h2 id="leaderboard-authors">{t('leaderboardMostActive')}</h2>
            {leaderboard.mostActiveAuthors.length === 0 ? (
              <p className="leaderboard-empty">{t('leaderboardEmpty')}</p>
            ) : (
              <ol className="leaderboard-list">
                {leaderboard.mostActiveAuthors.map((rank) => (
                  <li key={rank.author.id} className="leaderboard-author">
                    <FeedAvatar author={rank.author} />
                    <strong>{rank.author.username}</strong>
                    <span className="leaderboard-count">
                      {t('leaderboardPublicEntries', { count: rank.publicEntries })}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <EntryRanking
            id="leaderboard-liked"
            title={t('leaderboardMostLiked')}
            icon="heart"
            countKey="likesCount"
            entries={leaderboard.mostLikedEntries}
            t={t}
          />
          <EntryRanking
            id="leaderboard-commented"
            title={t('leaderboardMostCommented')}
            icon="comment"
            countKey="commentsCount"
            entries={leaderboard.mostCommentedEntries}
            t={t}
          />
        </div>
      )}
    </section>
  );
}

export default LeaderboardPage;
