import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PublicFeedFilters } from '../../services/api';
import { getTranslation } from '../../utils/translations';
import FeedPage from './FeedPage';

const fetchPublicFeed = vi.fn();
const fetchFollows = vi.fn();
const setTopicFollowing = vi.fn();
const feedService = { fetchPublicFeed, fetchFollows, setTopicFollowing, setFollowing: vi.fn(), setEntryLike: vi.fn() };

vi.mock('../../hooks/useFeedService', () => ({
  useFeedService: () => feedService,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: 'Me' } }),
}));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

const entry = (id: number, tags: string[]) => ({
  id,
  date: '2026-08-01',
  index: 1,
  tags,
  content: `Entry ${id}`,
  format: 'plain' as const,
  createdAt: '2026-08-01T12:00:00.000Z',
  commentCount: 0,
  likeCount: 0,
  liked: false,
  saved: false,
  author: { id: 2, username: 'Maya', avatarUrl: null, isFollowed: false },
});

const page = (entries: ReturnType<typeof entry>[]) => ({
  data: { entries, total: entries.length, page: 1, totalPages: 1, hasMore: false },
  error: null,
});

const follows = (topics: string[] = []) => ({
  data: { following: [], topics: topics.map((tag) => ({ tag, followedAt: '2026-08-01T00:00:00.000Z' })), followerCount: 0 },
  error: null,
});

/** The feed with its filters kept in state, as the route keeps them in the address. */
function FeedWithFilters({ initial = {} }: { readonly initial?: PublicFeedFilters }) {
  const [filters, setFilters] = useState<PublicFeedFilters>(initial);
  return <FeedPage t={t} filters={filters} onFiltersChange={setFilters} />;
}

describe('FeedPage topics and search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchFollows.mockResolvedValue(follows());
  });

  it('keeps tags as plain text when the page cannot open topics', async () => {
    fetchPublicFeed.mockResolvedValue(page([entry(1, ['calm'])]));
    render(<FeedPage t={t} />);

    expect(await screen.findByText('#calm')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '#calm' })).not.toBeInTheDocument();
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
  });

  it('opens a tag’s topic in the community tab, and closes it', async () => {
    fetchPublicFeed.mockResolvedValue(page([entry(1, ['Calm'])]));
    render(<FeedWithFilters initial={{ search: 'sea' }} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Saved' }));
    await waitFor(() => expect(fetchPublicFeed).toHaveBeenLastCalledWith('saved', 1, 10, { search: 'sea' }));
    const tag = await screen.findByRole('button', { name: '#Calm' });
    expect(tag).toHaveAttribute('title', 'Show the public entries tagged Calm');
    fireEvent.click(tag);

    await waitFor(() => expect(fetchPublicFeed).toHaveBeenLastCalledWith('community', 1, 10, { tag: 'Calm' }));
    expect(screen.getByRole('heading', { name: '#Calm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Community' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('searchbox', { name: 'Search public entries' })).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: 'Show every topic' }));
    await waitFor(() => expect(fetchPublicFeed).toHaveBeenLastCalledWith('community', 1, 10, {}));
    expect(screen.queryByRole('heading', { name: '#Calm' })).not.toBeInTheDocument();
  });

  it('searches the feed by its words, and clears the search', async () => {
    fetchPublicFeed.mockResolvedValue(page([]));
    render(<FeedWithFilters initial={{ tag: 'calm' }} />);

    const box = await screen.findByRole('searchbox', { name: 'Search public entries' });
    fireEvent.change(box, { target: { value: '  river walk ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(fetchPublicFeed).toHaveBeenLastCalledWith('community', 1, 10, { tag: 'calm', search: 'river walk' }));
    expect(await screen.findByText('No public entries in this view match this topic or search.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }));
    await waitFor(() => expect(fetchPublicFeed).toHaveBeenLastCalledWith('community', 1, 10, { tag: 'calm' }));
    expect(box).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear the search' })).not.toBeInTheDocument();

    fireEvent.change(box, { target: { value: '   ' } });
    fireEvent.submit(screen.getByRole('search'));
    await waitFor(() => expect(fetchPublicFeed).toHaveBeenLastCalledWith('community', 1, 10, { tag: 'calm' }));
  });

  it('follows the open topic, lists it in the following tab and unfollows it there', async () => {
    fetchPublicFeed.mockResolvedValue(page([entry(1, ['Calm'])]));
    setTopicFollowing
      .mockResolvedValueOnce({ data: { tag: 'calm', following: true }, error: null })
      .mockResolvedValueOnce({ data: { tag: 'calm', following: false }, error: null });
    render(<FeedWithFilters initial={{ tag: 'Calm' }} />);

    const follow = await screen.findByRole('button', { name: 'Follow the topic #Calm' });
    expect(follow).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(follow);
    await waitFor(() => expect(follow).toHaveAttribute('aria-pressed', 'true'));
    expect(follow).toHaveTextContent('Following the topic');
    expect(setTopicFollowing).toHaveBeenCalledWith('Calm', true);

    fireEvent.click(screen.getByRole('button', { name: 'Following' }));
    const topics = await screen.findByRole('list', { name: 'Topics you follow' });
    expect(within(topics).getByText('#calm')).toBeInTheDocument();

    fireEvent.click(within(topics).getByRole('button', { name: 'Unfollow the topic calm' }));
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Topics you follow' })).not.toBeInTheDocument());
    expect(setTopicFollowing).toHaveBeenLastCalledWith('calm', false);
    expect(follow).toHaveAttribute('aria-pressed', 'false');
  });

  it('knows a topic is followed whatever its case, and says when following fails', async () => {
    fetchFollows.mockResolvedValue(follows(['calm']));
    fetchPublicFeed.mockResolvedValue(page([]));
    let finish: (value: unknown) => void = () => undefined;
    setTopicFollowing.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<FeedWithFilters initial={{ tag: 'CALM' }} />);

    const follow = await screen.findByRole('button', { name: 'Following the topic #CALM' });
    expect(follow).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(follow);
    expect(follow).toBeDisabled();
    finish({ data: null, error: 'offline' });

    expect(await screen.findByRole('alert')).toHaveTextContent('The follow could not be updated. Please try again.');
    expect(follow).toBeEnabled();
    expect(follow).toHaveAttribute('aria-pressed', 'true');
  });
});
