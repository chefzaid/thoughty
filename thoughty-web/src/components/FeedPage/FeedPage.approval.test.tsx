import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTranslation } from '../../utils/translations';
import FeedPage from './FeedPage';

const fetchPublicFeed = vi.fn();
const fetchFollows = vi.fn();
const setFollowing = vi.fn();
const approveFollower = vi.fn();
const removeFollower = vi.fn();
const feedService = {
  fetchPublicFeed,
  fetchFollows,
  setFollowing,
  approveFollower,
  removeFollower,
  fetchComments: vi.fn(),
  setEntryLike: vi.fn(),
  setEntrySaved: vi.fn(),
};

vi.mock('../../hooks/useFeedService', () => ({
  useFeedService: () => feedService,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: 'Me' } }),
}));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

const author = (id: number, username: string, overrides = {}) => ({
  id,
  username,
  avatarUrl: null,
  isFollowed: false,
  followRequested: false,
  approvalRequired: true,
  ...overrides,
});

const teaser = (id: number, writer = author(2, 'Noor')) => ({
  id,
  date: '2026-08-01',
  index: 1,
  title: 'Letters to my sister',
  timeOfDay: null,
  tags: [],
  content: '',
  format: 'plain' as const,
  createdAt: '2026-08-01T12:00:00.000Z',
  commentCount: 0,
  likeCount: 0,
  liked: false,
  saved: false,
  locked: true,
  author: writer,
});

const page = (entries: unknown[]) => ({
  data: { entries, total: entries.length, page: 1, totalPages: 1, hasMore: false },
  error: null,
});

const user = (id: number, username: string) => ({ id, username, avatarUrl: null, followedAt: '2026-08-01T00:00:00.000Z' });

const follows = (overrides = {}) => ({
  data: {
    following: [],
    requested: [],
    topics: [],
    followers: [],
    followerCount: 0,
    requests: [],
    approvalRequired: false,
    ...overrides,
  },
  error: null,
});

describe('FeedPage followers by approval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchFollows.mockResolvedValue(follows());
  });

  it('shows a teaser with Ask to follow in place of the text, and turns it into Requested', async () => {
    fetchPublicFeed.mockResolvedValue(page([teaser(5)]));
    setFollowing.mockResolvedValue({ data: { userId: 2, following: false, requested: true }, error: null });
    render(<FeedPage t={t} />);

    const card = (await screen.findByText('Letters to my sister')).closest('article')!;
    expect(card).toHaveClass('feed-teaser');
    expect(within(card).getByText('Only the followers Noor approves can read this entry. Ask to follow to read it.')).toBeInTheDocument();
    // Nothing of what only approved followers get: no likes, comments, saving or reading aloud
    expect(within(card).queryByRole('button', { name: /like|comment|save|listen/i })).not.toBeInTheDocument();
    expect(within(card).getAllByRole('button', { name: /Noor$/ })).toHaveLength(2);

    fireEvent.click(within(card).getByRole('button', { name: 'Ask to follow Noor' }));

    expect(await within(card).findByRole('button', { name: 'Requested Noor' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(card).getByRole('button', { name: 'Requested Noor' })).toHaveAttribute(
      'title',
      'Withdraw your request to follow Noor',
    );
    expect(within(card).getByText('You asked to follow Noor. This entry opens once they approve.')).toBeInTheDocument();
    expect(setFollowing).toHaveBeenCalledWith(2, true);
  });

  it('withdraws a request from the card or from the list of requests sent', async () => {
    fetchPublicFeed.mockResolvedValue(page([teaser(5, author(2, 'Noor', { followRequested: true }))]));
    fetchFollows.mockResolvedValue(follows({ requested: [user(2, 'Noor')] }));
    setFollowing.mockResolvedValue({ data: { userId: 2, following: false, requested: false }, error: null });
    render(<FeedPage t={t} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Following' }));
    const sent = await screen.findByRole('list', { name: 'Waiting for approval' });
    fireEvent.click(within(sent).getByRole('button', { name: 'Withdraw your request to follow Noor' }));

    await waitFor(() => expect(screen.queryByRole('list', { name: 'Waiting for approval' })).not.toBeInTheDocument());
    expect(setFollowing).toHaveBeenCalledWith(2, false);
  });

  it('approves and declines the requests to follow the reader in the Following tab', async () => {
    fetchPublicFeed.mockResolvedValue(page([]));
    fetchFollows.mockResolvedValue(follows({ requests: [user(3, 'Pia'), user(4, 'Omar')], followers: [user(5, 'Lee')], followerCount: 1 }));
    approveFollower.mockResolvedValue({ data: { userId: 3, following: true, requested: false }, error: null });
    removeFollower.mockResolvedValue({ data: { userId: 4, following: false, requested: false }, error: null });
    render(<FeedPage t={t} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Following' }));
    const requests = await screen.findByRole('list', { name: 'Asking to follow you' });
    expect(screen.getByText('Requests: 2')).toBeInTheDocument();

    fireEvent.click(within(requests).getByRole('button', { name: 'Approve Pia' }));
    const followers = screen.getByRole('list', { name: 'Your followers' });
    await waitFor(() => expect(within(followers).getByText('Pia')).toBeInTheDocument());
    expect(screen.getByText('Followers: 2')).toBeInTheDocument();
    expect(approveFollower).toHaveBeenCalledWith(3);

    fireEvent.click(within(requests).getByRole('button', { name: 'Decline Omar' }));
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Asking to follow you' })).not.toBeInTheDocument());
    expect(removeFollower).toHaveBeenCalledWith(4);
    expect(within(followers).queryByText('Omar')).not.toBeInTheDocument();
  });

  it('keeps a request waiting when approving it fails, and says so', async () => {
    fetchPublicFeed.mockResolvedValue(page([]));
    fetchFollows.mockResolvedValue(follows({ requests: [user(3, 'Pia')] }));
    approveFollower.mockResolvedValue({ data: null, error: 'followRequestApproveError' });
    render(<FeedPage t={t} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Following' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Approve Pia' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Asking to follow you' })).toHaveTextContent('Pia');
  });

  it('offers Ask to follow on a readable entry by a writer who approves followers, and Following once approved', async () => {
    fetchPublicFeed.mockResolvedValue(page([
      { ...teaser(6, author(3, 'Lee', { isFollowed: true })), locked: false, content: 'Readable text', tags: ['walks'] },
    ]));
    render(<FeedPage t={t} />);

    expect(await screen.findByText('Readable text')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Following Lee' })).toHaveAttribute('aria-pressed', 'true');
  });
});
