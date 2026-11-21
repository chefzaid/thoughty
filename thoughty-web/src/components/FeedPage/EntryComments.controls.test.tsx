import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EntryComments from './EntryComments';
import { orderComments } from './useCommentThread';

const fetchComments = vi.fn();
const addComment = vi.fn();
const setCommentPolicy = vi.fn();
const setCommentHidden = vi.fn();
const setCommentPinned = vi.fn();
const feedService = {
  fetchComments,
  addComment,
  deleteComment: vi.fn(),
  setCommentLike: vi.fn(),
  setCommentPolicy,
  setCommentHidden,
  setCommentPinned,
} as never;
const ME = 102;

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' ')}` : key;

const comment = (id: number, username: string, flags: { hidden?: boolean; pinned?: boolean } = {}) => ({
  id,
  content: `Comment ${id}`,
  createdAt: `2026-09-0${id}T10:00:00.000Z`,
  author: { id: id + 200, username, avatarUrl: null },
  canDelete: true,
  likeCount: 0,
  liked: false,
  hidden: flags.hidden ?? false,
  pinned: flags.pinned ?? false,
});

function thread(comments: ReturnType<typeof comment>[], policy: Record<string, unknown>) {
  fetchComments.mockResolvedValue({ data: { comments, total: comments.length, ...policy }, error: null });
  render(<EntryComments entryId={8} authorName="Ada" commentCount={comments.length} currentUserId={ME} feedService={feedService} theme="light" t={t} />);
  fireEvent.click(screen.getByRole('button', { name: `commentsCount ${comments.length}` }));
}

const texts = () => screen.getAllByRole('listitem').map((item) => within(item).getByText(/^Comment \d$/).textContent);

describe('EntryComments controls', () => {
  beforeEach(() => vi.clearAllMocks());

  it('says why a reader cannot comment instead of offering the form', async () => {
    thread([comment(1, 'Ada')], { commentPolicy: 'followers', canComment: false, canModerate: false });
    expect(await screen.findByText('commentsFollowersOnlyNote Ada')).toBeInTheDocument();
    expect(screen.queryByLabelText('writeComment')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('commentPolicyLabel')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hideCommentBy/ })).not.toBeInTheDocument();
  });

  it('keeps closed comments readable', async () => {
    thread([comment(1, 'Ada')], { commentPolicy: 'closed', canComment: false, canModerate: false });
    expect(await screen.findByText('commentsClosedNote')).toBeInTheDocument();
    expect(screen.getByText('Comment 1')).toBeInTheDocument();
  });

  it('shows a refused comment’s reason and keeps the draft', async () => {
    addComment.mockResolvedValue({ data: null, error: 'apiError_COMMENTS_CLOSED' });
    thread([], { commentPolicy: 'everyone', canComment: true, canModerate: false });
    fireEvent.change(await screen.findByLabelText('writeComment'), { target: { value: 'Late' } });
    fireEvent.click(screen.getByRole('button', { name: 'postComment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('apiError_COMMENTS_CLOSED');
    expect(screen.getByLabelText('writeComment')).toHaveValue('Late');
  });

  it('lets the writer close comments and open them to followers', async () => {
    setCommentPolicy
      .mockResolvedValueOnce({ data: { commentPolicy: 'closed', canComment: false }, error: null })
      .mockResolvedValueOnce({ data: { commentPolicy: 'followers', canComment: true }, error: null })
      .mockResolvedValueOnce({ data: null, error: 'commentPolicyUpdateError' });
    thread([comment(1, 'Ada')], { commentPolicy: 'everyone', canComment: true, canModerate: true });
    const select = await screen.findByLabelText('commentPolicyLabel');
    expect(select).toHaveValue('everyone');

    fireEvent.change(select, { target: { value: 'closed' } });
    expect(await screen.findByText('commentsClosedNote')).toBeInTheDocument();
    expect(select).toHaveValue('closed');
    expect(screen.queryByLabelText('writeComment')).not.toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'followers' } });
    expect(await screen.findByLabelText('writeComment')).toBeInTheDocument();
    expect(setCommentPolicy.mock.calls).toEqual([[8, 'closed'], [8, 'followers']]);

    fireEvent.change(select, { target: { value: 'everyone' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('commentPolicyUpdateError');
    expect(select).toHaveValue('followers');
  });

  it('hides and shows a comment, taking it off the top', async () => {
    setCommentHidden
      .mockResolvedValueOnce({ data: comment(2, 'Leo', { hidden: true }), error: null })
      .mockResolvedValueOnce({ data: comment(2, 'Leo'), error: null });
    thread([comment(2, 'Leo', { pinned: true }), comment(1, 'Ada')], { commentPolicy: 'everyone', canComment: true, canModerate: true });
    await screen.findByText('Comment 2');
    expect(texts()).toEqual(['Comment 2', 'Comment 1']);
    expect(screen.getByText('commentPinned')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'hideCommentBy Leo' }));
    expect(await screen.findByText('commentHiddenForAuthor Leo')).toBeInTheDocument();
    expect(texts()).toEqual(['Comment 1', 'Comment 2']);
    // A hidden comment cannot be pinned until it is shown again
    expect(screen.queryByRole('button', { name: 'pinCommentBy Leo' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'showCommentBy Leo' }));
    await waitFor(() => expect(screen.queryByText('commentHiddenForAuthor Leo')).not.toBeInTheDocument());
    expect(setCommentHidden.mock.calls).toEqual([[8, 2, true], [8, 2, false]]);
  });

  it('pins one comment at a time and reports a failed change', async () => {
    setCommentPinned
      .mockResolvedValueOnce({ data: comment(2, 'Leo', { pinned: true }), error: null })
      .mockResolvedValueOnce({ data: null, error: 'commentUpdateError' });
    thread([comment(1, 'Ada', { pinned: true }), comment(2, 'Leo')], { commentPolicy: 'everyone', canComment: true, canModerate: true });
    await screen.findByText('Comment 1');

    fireEvent.click(screen.getByRole('button', { name: 'pinCommentBy Leo' }));
    expect(await screen.findByRole('button', { name: 'unpinCommentBy Leo' })).toHaveAttribute('aria-pressed', 'true');
    expect(texts()).toEqual(['Comment 2', 'Comment 1']);
    expect(screen.getByRole('button', { name: 'pinCommentBy Ada' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'unpinCommentBy Leo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('commentUpdateError');
    expect(setCommentPinned.mock.calls).toEqual([[8, 2, true], [8, 2, false]]);
  });

  it('tells each reader who sees a hidden comment', async () => {
    const own = { ...comment(2, 'Me', { hidden: true }), author: { id: ME, username: 'Me', avatarUrl: null } };
    thread([own], { commentPolicy: 'everyone', canComment: true, canModerate: true });
    expect(await screen.findByText('commentHiddenOwn')).toBeInTheDocument();
  });

  it('tells a comment’s writer the entry’s writer hid it', async () => {
    const own = { ...comment(2, 'Me', { hidden: true }), author: { id: ME, username: 'Me', avatarUrl: null } };
    thread([own], { commentPolicy: 'everyone', canComment: true, canModerate: false });
    expect(await screen.findByText('commentHiddenForWriter')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /showCommentBy/ })).not.toBeInTheDocument();
  });

  it('orders the pinned comment first, then by when each was written', () => {
    const same = { ...comment(3, 'Ana'), createdAt: comment(1, 'Ada').createdAt };
    expect(orderComments([comment(2, 'Leo'), same, comment(1, 'Ada'), comment(4, 'Bo', { pinned: true })]).map((c) => c.id)).toEqual([4, 1, 3, 2]);
  });
});
