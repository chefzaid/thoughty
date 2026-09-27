import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LeaderboardPage from './LeaderboardPage';

const fetchLeaderboard = vi.fn();
const feedService = { fetchLeaderboard };

vi.mock('../../hooks/useFeedService', () => ({
  useFeedService: () => feedService,
}));

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' ')}` : key;

const author = { id: 2, username: 'Maya', avatarUrl: null };
const leaderboard = {
  period: 'month',
  mostActiveAuthors: [{ author, publicEntries: 12 }],
  mostLikedEntries: [{ id: 8, date: '2026-09-20', excerpt: 'Liked <b>entry</b>', author, count: 5 }],
  mostCommentedEntries: [],
};

describe('LeaderboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchLeaderboard.mockResolvedValue({ data: leaderboard, error: null });
  });

  it('shows the monthly rankings with plain-text excerpts and empty sections', async () => {
    render(<LeaderboardPage onBack={vi.fn()} t={t} />);

    const liked = await screen.findByRole('region', { name: 'leaderboardMostLiked' });
    expect(within(liked).getByText('Liked <b>entry</b>')).toBeInTheDocument();
    expect(within(liked).getByText('likesCount 5')).toBeInTheDocument();
    const active = screen.getByRole('region', { name: 'leaderboardMostActive' });
    expect(within(active).getByText('leaderboardPublicEntries 12')).toBeInTheDocument();
    const commented = screen.getByRole('region', { name: 'leaderboardMostCommented' });
    expect(within(commented).getByText('leaderboardEmpty')).toBeInTheDocument();
    expect(fetchLeaderboard).toHaveBeenCalledWith('month');
    expect(screen.getByRole('button', { name: 'leaderboardMonth' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('reloads for another period and goes back to the feed', async () => {
    const onBack = vi.fn();
    render(<LeaderboardPage onBack={onBack} t={t} theme="light" />);
    await screen.findByRole('region', { name: 'leaderboardMostLiked' });

    fireEvent.click(screen.getByRole('button', { name: 'leaderboardAllTime' }));
    expect(fetchLeaderboard).toHaveBeenLastCalledWith('all');
    await screen.findByRole('region', { name: 'leaderboardMostLiked' });

    fireEvent.click(screen.getByRole('button', { name: 'backToFeed' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('offers a retry when loading fails', async () => {
    fetchLeaderboard.mockResolvedValueOnce({ data: null, error: 'Failed' });
    render(<LeaderboardPage onBack={vi.fn()} t={t} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('leaderboardLoadError');
    fireEvent.click(screen.getByRole('button', { name: /tryAgain/ }));

    expect(await screen.findByRole('region', { name: 'leaderboardMostLiked' })).toBeInTheDocument();
    expect(fetchLeaderboard).toHaveBeenCalledTimes(2);
  });
});
