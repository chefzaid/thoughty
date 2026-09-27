import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FeedPage from './FeedPage';

const fetchPublicFeed = vi.fn();
const fetchFollows = vi.fn();
const setFollowing = vi.fn();
const setEntryLike = vi.fn();
const feedService = { fetchPublicFeed, fetchFollows, setFollowing, setEntryLike };

vi.mock('../../hooks/useFeedService', () => ({
  useFeedService: () => feedService,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: 'Me' } }),
}));

const t = (key: string, params?: Record<string, string | number>) => {
  if (key === 'feedCount') return `${params?.count} of ${params?.total}`;
  if (params) return `${key} ${Object.values(params).join(' ')}`;
  return key;
};

const createEntry = (id: number, username: string, isFollowed = false) => ({
  id,
  date: '2026-08-01',
  index: 1,
  tags: ['notes'],
  content: `Entry ${id}`,
  format: 'plain' as const,
  createdAt: '2026-08-01T12:00:00.000Z',
  commentCount: 0,
  likeCount: 1,
  liked: false,
  author: { id: id + 100, username, avatarUrl: null, isFollowed },
});

describe('FeedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchFollows.mockResolvedValue({ data: { following: [], followerCount: 0 }, error: null });
  });

  it('loads community entries and appends the next page', async () => {
    fetchPublicFeed
      .mockResolvedValueOnce({
        data: { entries: [createEntry(1, 'Ada')], total: 2, page: 1, totalPages: 2, hasMore: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { entries: [createEntry(2, 'Lin')], total: 2, page: 2, totalPages: 2, hasMore: false },
        error: null,
      });

    render(<FeedPage t={t} />);

    expect(await screen.findByText('Entry 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'loadMoreEntries' }));
    expect(await screen.findByText('Entry 2')).toBeInTheDocument();
    expect(fetchPublicFeed).toHaveBeenNthCalledWith(1, 'community', 1, 10);
    expect(fetchPublicFeed).toHaveBeenNthCalledWith(2, 'community', 2, 10);
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
  });

  it('replaces community entries when switching to the own-public preview', async () => {
    fetchPublicFeed
      .mockResolvedValueOnce({
        data: { entries: [createEntry(1, 'Ada')], total: 1, page: 1, totalPages: 1, hasMore: false },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { entries: [createEntry(3, 'Me')], total: 1, page: 1, totalPages: 1, hasMore: false },
        error: null,
      });

    render(<FeedPage t={t} theme="light" />);
    expect(await screen.findByText('Entry 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'feedMine' }));

    expect(await screen.findByText('Entry 3')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Entry 1')).not.toBeInTheDocument());
    expect(fetchPublicFeed).toHaveBeenLastCalledWith('mine', 1, 10);
  });

  it('offers retry after an initial loading failure', async () => {
    fetchPublicFeed
      .mockResolvedValueOnce({ data: null, error: 'Unavailable' })
      .mockResolvedValueOnce({
        data: { entries: [createEntry(4, 'Grace')], total: 1, page: 1, totalPages: 1, hasMore: false },
        error: null,
      });

    render(<FeedPage t={t} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('feedLoadError');
    fireEvent.click(screen.getByRole('button', { name: /tryAgain/ }));
    expect(await screen.findByText('Entry 4')).toBeInTheDocument();
  });

  it('completes the initial request during Strict Mode effect replay', async () => {
    fetchPublicFeed.mockResolvedValue({
      data: { entries: [createEntry(5, 'Katherine')], total: 1, page: 1, totalPages: 1, hasMore: false },
      error: null,
    });

    render(<StrictMode><FeedPage t={t} /></StrictMode>);

    expect(await screen.findByText('Entry 5')).toBeInTheDocument();
    expect(fetchPublicFeed).toHaveBeenCalledTimes(2);
  });

  it('follows an author and updates every card by that author', async () => {
    fetchPublicFeed.mockResolvedValue({
      data: {
        entries: [createEntry(1, 'Ada'), { ...createEntry(2, 'Ada'), author: createEntry(1, 'Ada').author }],
        total: 2,
        page: 1,
        totalPages: 1,
        hasMore: false,
      },
      error: null,
    });
    setFollowing.mockResolvedValue({ data: { userId: 101, following: true }, error: null });

    render(<FeedPage t={t} />);
    await screen.findByText('Entry 1');
    const [firstFollowButton] = screen.getAllByRole('button', { name: 'followAuthor Ada' });
    fireEvent.click(firstFollowButton!);

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'followingAuthor Ada' })).toHaveLength(2));
    expect(setFollowing).toHaveBeenCalledWith(101, true);
    for (const button of screen.getAllByRole('button', { name: 'followingAuthor Ada' })) {
      expect(button).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it('keeps the follow state and reports an error when the update fails', async () => {
    fetchPublicFeed.mockResolvedValue({
      data: { entries: [createEntry(1, 'Ada', true)], total: 1, page: 1, totalPages: 1, hasMore: false },
      error: null,
    });
    setFollowing.mockResolvedValue({ data: null, error: 'Failed' });

    render(<FeedPage t={t} />);
    fireEvent.click(await screen.findByRole('button', { name: 'followingAuthor Ada' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('followUpdateError');
    expect(setFollowing).toHaveBeenCalledWith(101, false);
    expect(screen.getByRole('button', { name: 'followingAuthor Ada' })).toBeEnabled();
  });

  it('shows followed people in the following scope and unfollows from the list', async () => {
    fetchFollows.mockResolvedValue({
      data: {
        following: [
          { id: 102, username: 'Zoe', avatarUrl: null, followedAt: '2026-08-01T00:00:00.000Z' },
          { id: 101, username: 'Ada', avatarUrl: '/ada.png', followedAt: '2026-08-02T00:00:00.000Z' },
        ],
        followerCount: 4,
      },
      error: null,
    });
    fetchPublicFeed.mockResolvedValue({
      data: { entries: [createEntry(1, 'Ada', true)], total: 1, page: 1, totalPages: 1, hasMore: false },
      error: null,
    });
    setFollowing.mockResolvedValue({ data: { userId: 101, following: false }, error: null });

    render(<FeedPage t={t} />);
    await screen.findByText('Entry 1');
    fireEvent.click(screen.getByRole('button', { name: 'feedFollowing' }));

    expect(await screen.findByRole('heading', { name: 'followingListTitle' })).toBeInTheDocument();
    expect(fetchPublicFeed).toHaveBeenLastCalledWith('following', 1, 10);
    expect(screen.getByText('followingCount 2')).toBeInTheDocument();
    expect(screen.getByText('followersCount 4')).toBeInTheDocument();
    const names = [...document.querySelectorAll('.feed-following-name')].map((item) => item.textContent);
    expect(names).toEqual(['Ada', 'Zoe']);

    fireEvent.click(screen.getByRole('button', { name: 'unfollowAuthor Ada' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'unfollowAuthor Ada' })).not.toBeInTheDocument());
    expect(setFollowing).toHaveBeenCalledWith(101, false);
    expect(screen.getByText('followingCount 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'followAuthor Ada' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows empty and error states for the following list', async () => {
    fetchPublicFeed.mockResolvedValue({
      data: { entries: [], total: 0, page: 1, totalPages: 0, hasMore: false },
      error: null,
    });

    const { unmount } = render(<FeedPage t={t} />);
    fireEvent.click(screen.getByRole('button', { name: 'feedFollowing' }));
    expect(await screen.findByText('followingListEmpty')).toBeInTheDocument();
    expect(await screen.findByText('feedEmptyFollowing')).toBeInTheDocument();
    unmount();

    fetchFollows.mockResolvedValue({ data: null, error: 'Failed' });
    render(<FeedPage t={t} />);
    fireEvent.click(screen.getByRole('button', { name: 'feedFollowing' }));
    expect(await screen.findByText('followsLoadError')).toBeInTheDocument();
  });

  it('does not offer to follow your own public entries', async () => {
    fetchPublicFeed.mockResolvedValue({
      data: { entries: [createEntry(3, 'Me')], total: 1, page: 1, totalPages: 1, hasMore: false },
      error: null,
    });

    render(<FeedPage t={t} />);
    fireEvent.click(screen.getByRole('button', { name: 'feedMine' }));

    await waitFor(() => expect(fetchPublicFeed).toHaveBeenLastCalledWith('mine', 1, 10));
    await screen.findByText('Entry 3');
    expect(screen.queryByRole('button', { name: /followAuthor/ })).not.toBeInTheDocument();
  });

  it('likes community entries but only shows the count on your own', async () => {
    fetchPublicFeed
      .mockResolvedValueOnce({
        data: { entries: [createEntry(1, 'Ada')], total: 1, page: 1, totalPages: 1, hasMore: false },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { entries: [createEntry(3, 'Me')], total: 1, page: 1, totalPages: 1, hasMore: false },
        error: null,
      });
    setEntryLike.mockResolvedValue({ data: { liked: true, likeCount: 2 }, error: null });

    render(<FeedPage t={t} />);
    fireEvent.click(await screen.findByRole('button', { name: 'likeEntryBy Ada, likesCount 1' }));

    expect(await screen.findByRole('button', { name: 'likeEntryBy Ada, likesCount 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(setEntryLike).toHaveBeenCalledWith(1, true);

    fireEvent.click(screen.getByRole('button', { name: 'feedMine' }));
    await screen.findByText('Entry 3');
    expect(screen.queryByRole('button', { name: /likeEntryBy/ })).not.toBeInTheDocument();
    expect(screen.getByTitle('likes')).toHaveTextContent('1');
  });

  it('opens the leaderboard from the header when the route allows it', async () => {
    fetchPublicFeed.mockResolvedValue({
      data: { entries: [], total: 0, page: 1, totalPages: 0, hasMore: false },
      error: null,
    });
    const onOpenLeaderboard = vi.fn();

    const { unmount } = render(<FeedPage t={t} />);
    expect(screen.queryByRole('button', { name: 'leaderboard' })).not.toBeInTheDocument();
    unmount();

    render(<FeedPage t={t} onOpenLeaderboard={onOpenLeaderboard} />);
    fireEvent.click(screen.getByRole('button', { name: 'leaderboard' }));
    expect(onOpenLeaderboard).toHaveBeenCalled();
    await screen.findByText('feedEmptyCommunity');
  });
});
