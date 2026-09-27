import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AchievementsSection from './AchievementsSection';

const fetchAchievements = vi.fn();
const feedService = { fetchAchievements };

vi.mock('../../hooks/useFeedService', () => ({
  useFeedService: () => feedService,
}));

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' ')}` : key;

const achievements = {
  karma: 14,
  stats: {
    publicEntries: 3,
    totalEntries: 120,
    longestStreak: 9,
    likesReceived: 10,
    commentsReceived: 2,
    commentsWritten: 1,
    followers: 2,
  },
  badges: [
    { id: 'well-liked', metric: 'likesReceived', threshold: 10, progress: 10, earned: true },
    { id: 'month-streak', metric: 'longestStreak', threshold: 30, progress: 9, earned: false },
    { id: 'future-badge', metric: 'followers', threshold: 1000, progress: 2, earned: false },
  ],
};

describe('AchievementsSection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows karma, stats, earned badges, and progress toward locked ones', async () => {
    fetchAchievements.mockResolvedValue({ data: achievements, error: null });
    render(<AchievementsSection t={t} />);

    expect(await screen.findByText('14')).toBeInTheDocument();
    const stats = screen.getByText('achievementStatLikesReceived').closest('dl')!;
    expect(within(stats).getByText('achievementStatLikesReceived')).toBeInTheDocument();
    expect(within(stats).getByText('9')).toBeInTheDocument();

    const earned = screen.getByText('badgeWellLiked').closest('li')!;
    expect(earned).toHaveClass('earned');
    expect(within(earned).getByText('badgeEarned')).toBeInTheDocument();

    const locked = screen.getByText('badgeMonthStreak').closest('li')!;
    expect(within(locked).getByText('badgeMonthStreakDescription 30')).toBeInTheDocument();
    expect(within(locked).getByRole('progressbar', { name: 'badgeProgress 9 30' })).toHaveAttribute('value', '9');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it.each([
    [{ data: null, error: 'Failed' }],
    [{ data: { success: true }, error: null }],
  ])('reports a load error for %p', async (result) => {
    fetchAchievements.mockResolvedValue(result);
    render(<AchievementsSection t={t} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('achievementsLoadError');
  });
});
