import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTranslation } from '../../utils/translations';
import FeedPage from './FeedPage';

const fetchPublicFeed = vi.fn();
const fetchFollows = vi.fn();
const setEntrySaved = vi.fn();
const feedService = { fetchPublicFeed, fetchFollows, setFollowing: vi.fn(), setEntryLike: vi.fn(), setEntrySaved };

vi.mock('../../hooks/useFeedService', () => ({
  useFeedService: () => feedService,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: 'Me' } }),
}));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

const entry = (id: number, authorId: number, username: string, saved = false) => ({
  id,
  date: '2026-08-01',
  index: 1,
  tags: [],
  content: `Entry ${id}`,
  format: 'plain' as const,
  createdAt: '2026-08-01T12:00:00.000Z',
  commentCount: 0,
  likeCount: 0,
  liked: false,
  saved,
  author: { id: authorId, username, avatarUrl: null, isFollowed: false },
});

const page = (entries: ReturnType<typeof entry>[]) => ({
  data: { entries, total: entries.length, page: 1, totalPages: 1, hasMore: false },
  error: null,
});

describe('FeedPage saved entries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchFollows.mockResolvedValue({ data: { following: [], topics: [], followers: [], followerCount: 0 }, error: null });
  });

  it('saves and unsaves another writer’s entry', async () => {
    fetchPublicFeed.mockResolvedValue(page([entry(1, 2, 'Maya')]));
    setEntrySaved
      .mockResolvedValueOnce({ data: { saved: true }, error: null })
      .mockResolvedValueOnce({ data: { saved: false }, error: null });
    render(<FeedPage t={t} />);

    const save = await screen.findByRole('button', { name: 'Save the entry by Maya' });
    expect(save).toHaveAttribute('aria-pressed', 'false');
    expect(save).toHaveTextContent('Save');
    fireEvent.click(save);
    await waitFor(() => expect(save).toHaveAttribute('aria-pressed', 'true'));
    expect(save).toHaveTextContent('Saved');
    fireEvent.click(save);
    await waitFor(() => expect(save).toHaveAttribute('aria-pressed', 'false'));
    expect(setEntrySaved.mock.calls).toEqual([[1, true], [1, false]]);
  });

  it('says so when the Saved list cannot be updated, and keeps the entry as it was', async () => {
    fetchPublicFeed.mockResolvedValue(page([entry(1, 2, 'Maya', true)]));
    setEntrySaved.mockResolvedValue({ data: null, error: 'Failed' });
    render(<FeedPage t={t} />);

    const save = await screen.findByRole('button', { name: 'Save the entry by Maya' });
    expect(save).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(save);

    expect(await screen.findByRole('alert')).toHaveTextContent('Your Saved list could not be updated.');
    expect(save).toHaveAttribute('aria-pressed', 'true');
  });

  it('lists the saved entries, and offers neither saving nor writing about the reader’s own', async () => {
    fetchPublicFeed
      .mockResolvedValueOnce(page([entry(1, 2, 'Maya')]))
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(page([entry(3, 1, 'Me')]));
    const onWriteAbout = vi.fn();
    render(<FeedPage t={t} onWriteAbout={onWriteAbout} />);
    await screen.findByText('Entry 1');

    fireEvent.click(screen.getByRole('button', { name: 'Saved' }));
    expect(await screen.findByText(/Nothing saved yet/)).toBeInTheDocument();
    expect(fetchPublicFeed).toHaveBeenLastCalledWith('saved', 1, 10, {});

    fireEvent.click(screen.getByRole('button', { name: 'My public entries' }));
    await screen.findByText('Entry 3');
    expect(screen.queryByRole('button', { name: /Save the entry/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Write about the entry/ })).not.toBeInTheDocument();
  });

  it('writes about another writer’s entry', async () => {
    const maya = entry(1, 2, 'Maya');
    fetchPublicFeed.mockResolvedValue(page([maya]));
    const onWriteAbout = vi.fn();
    const { unmount } = render(<FeedPage t={t} onWriteAbout={onWriteAbout} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Write about the entry by Maya' }));
    expect(onWriteAbout).toHaveBeenCalledWith(maya);
    unmount();

    // Without a journal to write in, it is not offered
    render(<FeedPage t={t} />);
    await screen.findByText('Entry 1');
    expect(screen.queryByRole('button', { name: /Write about/ })).not.toBeInTheDocument();
  });
});
