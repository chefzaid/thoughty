import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTranslation } from '../../utils/translations';
import FeedPage from './FeedPage';

const fetchPublicFeed = vi.fn();
const fetchFollows = vi.fn();
const fetchComments = vi.fn();
const setWriterMuted = vi.fn();
const setWriterBlocked = vi.fn();
const removeFollower = vi.fn();
const feedService = {
  fetchPublicFeed,
  fetchFollows,
  fetchComments,
  setWriterMuted,
  setWriterBlocked,
  removeFollower,
  setFollowing: vi.fn(),
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

const entry = (id: number, authorId: number, username: string, commentCount = 0) => ({
  id,
  date: '2026-08-01',
  index: 1,
  tags: [],
  content: `Entry ${id}`,
  format: 'plain' as const,
  createdAt: '2026-08-01T12:00:00.000Z',
  commentCount,
  likeCount: 0,
  liked: false,
  saved: false,
  author: { id: authorId, username, avatarUrl: null, isFollowed: false },
});

const page = (entries: ReturnType<typeof entry>[]) => ({
  data: { entries, total: entries.length, page: 1, totalPages: 1, hasMore: false },
  error: null,
});

const user = (id: number, username: string) => ({ id, username, avatarUrl: null, followedAt: '2026-08-01T00:00:00.000Z' });

const follows = (overrides = {}) => ({
  data: { following: [], topics: [], followers: [], followerCount: 0, ...overrides },
  error: null,
});

const openMenu = async (username: string) => {
  fireEvent.click(await screen.findByRole('button', { name: `More for ${username}` }));
  return screen.getByRole('menu', { name: `More for ${username}` });
};

describe('FeedPage muting and blocking writers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchFollows.mockResolvedValue(follows());
  });

  it('mutes a writer from the menu beside their name: their entries and comments leave the page', async () => {
    fetchPublicFeed.mockResolvedValue(page([entry(1, 2, 'Maya'), entry(2, 3, 'Noor', 1)]));
    fetchComments.mockResolvedValue({
      data: {
        comments: [{
          id: 9,
          content: 'A comment by Maya',
          createdAt: '2026-08-01T13:00:00.000Z',
          author: { id: 2, username: 'Maya', avatarUrl: null },
          canDelete: false,
          likeCount: 0,
          liked: false,
          hidden: false,
          pinned: false,
        }],
        total: 1,
        commentPolicy: 'everyone',
        canComment: true,
        canModerate: false,
      },
      error: null,
    });
    setWriterMuted.mockResolvedValue({ data: { userId: 2, muted: true }, error: null });
    render(<FeedPage t={t} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Comments (1)' }));
    expect(await screen.findByText('A comment by Maya')).toBeInTheDocument();
    const menu = await openMenu('Maya');
    expect(within(menu).getByRole('menuitem', { name: 'Mute Maya' })).toHaveFocus();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Mute Maya' }));

    await waitFor(() => expect(screen.queryByText('Entry 1')).not.toBeInTheDocument());
    expect(setWriterMuted).toHaveBeenCalledWith(2, true);
    expect(screen.getByText('Entry 2')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('A comment by Maya')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Comments (0)' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('You muted Maya');
    expect(screen.queryByRole('button', { name: 'More for Me' })).not.toBeInTheDocument();
  });

  it('asks before blocking, then drops the writer from the page and from the follows', async () => {
    fetchFollows.mockResolvedValue(follows({ following: [user(2, 'Maya')], followers: [user(2, 'Maya')], followerCount: 1 }));
    fetchPublicFeed.mockResolvedValue(page([entry(1, 2, 'Maya')]));
    setWriterBlocked.mockResolvedValue({ data: { userId: 2, blocked: true }, error: null });
    render(<FeedPage t={t} />);

    fireEvent.click(within(await openMenu('Maya')).getByRole('menuitem', { name: 'Block Maya' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Block Maya?' });
    expect(dialog).toHaveTextContent('Maya is not told.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(setWriterBlocked).not.toHaveBeenCalled();
    expect(screen.getByText('Entry 1')).toBeInTheDocument();

    fireEvent.click(within(await openMenu('Maya')).getByRole('menuitem', { name: 'Block Maya' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Block' }));

    await waitFor(() => expect(screen.queryByText('Entry 1')).not.toBeInTheDocument());
    expect(setWriterBlocked).toHaveBeenCalledWith(2, true);
    expect(screen.getByRole('status')).toHaveTextContent('You blocked Maya.');
    fireEvent.click(screen.getByRole('button', { name: 'Following' }));
    expect(await screen.findByText('Nobody follows you yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unfollow Maya' })).not.toBeInTheDocument();
  });

  it('keeps the entries and says so when muting fails', async () => {
    fetchPublicFeed.mockResolvedValue(page([entry(1, 2, 'Maya')]));
    setWriterMuted.mockResolvedValue({ data: null, error: 'writerMuteError' });
    render(<FeedPage t={t} />);

    fireEvent.click(within(await openMenu('Maya')).getByRole('menuitem', { name: 'Mute Maya' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This writer could not be muted.');
    expect(screen.getByText('Entry 1')).toBeInTheDocument();
  });

  it('moves through the menu with the arrow keys and closes it with Escape or a click outside', async () => {
    fetchPublicFeed.mockResolvedValue(page([entry(1, 2, 'Maya')]));
    render(<FeedPage t={t} />);

    const menu = await openMenu('Maya');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(within(menu).getByRole('menuitem', { name: 'Block Maya' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(within(menu).getByRole('menuitem', { name: 'Mute Maya' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'Tab' });
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More for Maya' })).toHaveFocus();

    await openMenu('Maya');
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('lists the reader’s followers and removes one quietly', async () => {
    fetchFollows.mockResolvedValue(follows({ followers: [user(4, 'Zed'), user(3, 'Lin')], followerCount: 2 }));
    fetchPublicFeed.mockResolvedValue(page([]));
    removeFollower
      .mockResolvedValueOnce({ data: null, error: 'followerRemoveError' })
      .mockResolvedValueOnce({ data: { userId: 3, following: false }, error: null });
    render(<FeedPage t={t} />);

    fireEvent.click(screen.getByRole('button', { name: 'Following' }));
    const list = await screen.findByRole('list', { name: 'Your followers' });
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['LLin', 'ZZed']);
    fireEvent.click(within(list).getByRole('button', { name: 'Remove Lin from your followers' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    fireEvent.click(within(list).getByRole('button', { name: 'Remove Lin from your followers' }));
    await waitFor(() => expect(within(list).queryByText('Lin')).not.toBeInTheDocument());
    expect(removeFollower).toHaveBeenCalledWith(3);
    expect(screen.getByText('Followers: 1')).toBeInTheDocument();
  });
});
