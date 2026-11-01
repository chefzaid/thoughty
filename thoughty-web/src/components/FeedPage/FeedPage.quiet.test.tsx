import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { QuietModeOn } from '../../test/quietMode';
import FeedPage from './FeedPage';

const fetchPublicFeed = vi.fn();
const fetchFollows = vi.fn();
const setEntryLike = vi.fn();
const feedService = { fetchPublicFeed, fetchFollows, setFollowing: vi.fn(), setEntryLike };

vi.mock('../../hooks/useFeedService', () => ({
  useFeedService: () => feedService,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: 'Me' } }),
}));

const t = (key: string, params?: Record<string, string | number>) => (params ? `${key} ${Object.values(params).join(' ')}` : key);

const entry = (id: number, username: string) => ({
  id,
  date: '2026-08-01',
  index: 1,
  tags: [],
  content: `Entry ${id}`,
  format: 'plain' as const,
  createdAt: '2026-08-01T12:00:00.000Z',
  commentCount: 5,
  likeCount: 7,
  liked: false,
  author: { id: id + 100, username, avatarUrl: null, isFollowed: false },
});

const page = (entries: ReturnType<typeof entry>[]) => ({
  data: { entries, total: entries.length, page: 1, totalPages: 1, hasMore: false },
  error: null,
});

describe('FeedPage in quiet mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchFollows.mockResolvedValue({ data: { following: [{ id: 101, username: 'Ada', avatarUrl: null, followedAt: '2026-08-01T00:00:00.000Z' }], followerCount: 4 }, error: null });
  });

  it('keeps liking, comments and follows, without a count', async () => {
    fetchPublicFeed.mockResolvedValueOnce(page([entry(1, 'Ada')])).mockResolvedValue(page([entry(3, 'Me')]));
    setEntryLike.mockResolvedValue({ data: { liked: true, likeCount: 8 }, error: null });

    render(<FeedPage t={t} />, { wrapper: QuietModeOn });

    const like = await screen.findByRole('button', { name: 'likeEntryBy Ada' });
    expect(like).toHaveTextContent(/^$/);
    fireEvent.click(like);
    expect(await screen.findByRole('button', { name: 'likeEntryBy Ada', pressed: true })).not.toHaveTextContent('8');
    expect(screen.getByRole('button', { name: 'quietModeComments' })).toBeInTheDocument();
    expect(screen.queryByText(/commentsCount/)).not.toBeInTheDocument();

    // Your own entry shows no like count at all
    fireEvent.click(screen.getByRole('button', { name: 'feedMine' }));
    await screen.findByText('Entry 3');
    expect(screen.queryByTitle('likes')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'feedFollowing' }));
    expect(await screen.findByRole('heading', { name: 'followingListTitle' })).toBeInTheDocument();
    expect(screen.getByText('Ada', { selector: '.feed-following-name' })).toBeInTheDocument();
    expect(screen.queryByText(/followingCount|followersCount/)).not.toBeInTheDocument();
  });
});
