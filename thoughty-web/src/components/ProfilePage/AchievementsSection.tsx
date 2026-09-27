import { useEffect, useState } from 'react';

import { useFeedService } from '../../hooks/useFeedService';
import type { Achievements } from '../../services/api';
import type { TranslationKey } from '../../utils/translations';
import type { TranslationFunction } from './types';
import './AchievementsSection.css';

type Badge = Achievements['badges'][number];
type Stat = keyof Achievements['stats'];

interface BadgeDisplay {
  readonly icon: string;
  readonly name: TranslationKey;
  readonly description: TranslationKey;
}

const BADGE_DISPLAY: Record<string, BadgeDisplay> = {
  'first-public-entry': { icon: 'globe', name: 'badgeFirstPublicEntry', description: 'badgeFirstPublicEntryDescription' },
  storyteller: { icon: 'book', name: 'badgeStoryteller', description: 'badgeStorytellerDescription' },
  'hundred-entries': { icon: 'notebook', name: 'badgeHundredEntries', description: 'badgeHundredEntriesDescription' },
  'week-streak': { icon: 'flame', name: 'badgeWeekStreak', description: 'badgeWeekStreakDescription' },
  'month-streak': { icon: 'calendar', name: 'badgeMonthStreak', description: 'badgeMonthStreakDescription' },
  'well-liked': { icon: 'heart', name: 'badgeWellLiked', description: 'badgeWellLikedDescription' },
  beloved: { icon: 'heart-filled', name: 'badgeBeloved', description: 'badgeBelovedDescription' },
  'conversation-starter': { icon: 'comment-discussion', name: 'badgeConversationStarter', description: 'badgeConversationStarterDescription' },
  'community-voice': { icon: 'comment', name: 'badgeCommunityVoice', description: 'badgeCommunityVoiceDescription' },
  connector: { icon: 'organization', name: 'badgeConnector', description: 'badgeConnectorDescription' },
};

const STAT_LABELS: ReadonlyArray<[Stat, TranslationKey]> = [
  ['likesReceived', 'achievementStatLikesReceived'],
  ['commentsReceived', 'achievementStatCommentsReceived'],
  ['followers', 'achievementStatFollowers'],
  ['publicEntries', 'achievementStatPublicEntries'],
  ['longestStreak', 'achievementStatLongestStreak'],
];

function BadgeCard({ badge, t }: Readonly<{ badge: Badge; t: TranslationFunction }>) {
  const display = BADGE_DISPLAY[badge.id];
  // A badge added on the server before this client knows it is skipped rather than shown untranslated.
  if (!display) return null;

  return (
    <li className={`achievement-badge ${badge.earned ? 'earned' : 'locked'}`}>
      <span className={`codicon codicon-${display.icon} achievement-icon`} aria-hidden="true" />
      <div className="achievement-text">
        <strong>{t(display.name)}</strong>
        <span>{t(display.description, { count: badge.threshold })}</span>
        {badge.earned ? (
          <span className="achievement-status">
            <span className="codicon codicon-pass-filled" aria-hidden="true" /> {t('badgeEarned')}
          </span>
        ) : (
          <progress
            value={badge.progress}
            max={badge.threshold}
            aria-label={t('badgeProgress', { progress: badge.progress, threshold: badge.threshold })}
          />
        )}
      </div>
    </li>
  );
}

function AchievementsSection({ t }: Readonly<{ t: TranslationFunction }>) {
  const feedService = useFeedService();
  const [achievements, setAchievements] = useState<Achievements | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void feedService.fetchAchievements().then((result) => {
      if (!active) return;
      const data = result.data?.stats && Array.isArray(result.data.badges) ? result.data : null;
      setAchievements(data);
      setError(!data);
    });
    return () => {
      active = false;
    };
  }, [feedService]);

  return (
    <section className="profile-section achievements-section" aria-labelledby="achievements-heading">
      <div className="section-header">
        <span className="codicon codicon-verified-filled section-icon" aria-hidden="true" />
        <h3 id="achievements-heading" className="section-title">{t('achievements')}</h3>
      </div>
      <div className="section-content">
        {!achievements && !error && <p className="achievements-note">{t('loading')}</p>}
        {error && <p className="achievements-note error" role="alert">{t('achievementsLoadError')}</p>}
        {achievements && (
          <>
            <div className="achievements-summary">
              <p className="achievements-karma">
                <span className="achievements-karma-value">{achievements.karma}</span>
                <span>{t('karma')}</span>
              </p>
              <dl className="achievements-stats">
                {STAT_LABELS.map(([stat, label]) => (
                  <div key={stat}>
                    <dt>{t(label)}</dt>
                    <dd>{achievements.stats[stat]}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="achievements-note">{t('karmaExplanation')}</p>
            <ul className="achievement-badges">
              {achievements.badges.map((badge) => <BadgeCard key={badge.id} badge={badge} t={t} />)}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

export default AchievementsSection;
