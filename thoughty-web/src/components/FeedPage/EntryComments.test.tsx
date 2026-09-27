import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EntryComments from './EntryComments';

const fetchComments = vi.fn();
const addComment = vi.fn();
const deleteComment = vi.fn();
const setCommentLike = vi.fn();
const feedService = { fetchComments, addComment, deleteComment, setCommentLike } as never;
const ME = 102;

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' ')}` : key;

const comment = (id: number, username: string, canDelete: boolean) => ({
  id,
  content: `Comment ${id} <b>raw</b>`,
  createdAt: '2026-09-01T10:00:00.000Z',
  author: { id: id + 100, username, avatarUrl: null },
  canDelete,
  likeCount: id === 1 ? 2 : 0,
  liked: false,
});

function renderThread(commentCount = 2) {
  render(<EntryComments entryId={8} commentCount={commentCount} currentUserId={ME} feedService={feedService} theme="dark" t={t} />);
  fireEvent.click(screen.getByRole('button', { name: `commentsCount ${commentCount}` }));
}

describe('EntryComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchComments.mockResolvedValue({
      data: { comments: [comment(1, 'Ada', false), comment(2, 'Me', true)], total: 2 },
      error: null,
    });
  });

  it('loads the thread only when opened and renders comments as plain text', async () => {
    render(<EntryComments entryId={8} commentCount={2} currentUserId={ME} feedService={feedService} theme="dark" t={t} />);
    const toggle = screen.getByRole('button', { name: 'commentsCount 2' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(fetchComments).not.toHaveBeenCalled();

    fireEvent.click(toggle);

    expect(await screen.findByText('Comment 1 <b>raw</b>')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(fetchComments).toHaveBeenCalledWith(8);
    expect(screen.queryByRole('button', { name: 'deleteCommentBy Ada' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'deleteCommentBy Me' })).toBeInTheDocument();
  });

  it('posts a trimmed comment and updates the count', async () => {
    addComment.mockResolvedValue({ data: comment(3, 'Me', true), error: null });
    renderThread();
    await screen.findByText('Comment 1 <b>raw</b>');

    const postButton = screen.getByRole('button', { name: 'postComment' });
    expect(postButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('writeComment'), { target: { value: '  Hello there  ' } });
    fireEvent.click(postButton);

    expect(await screen.findByText('Comment 3 <b>raw</b>')).toBeInTheDocument();
    expect(addComment).toHaveBeenCalledWith(8, 'Hello there');
    expect(screen.getByRole('button', { name: 'commentsCount 3' })).toBeInTheDocument();
    expect(screen.getByLabelText('writeComment')).toHaveValue('');
  });

  it('keeps the draft and reports an error when posting fails', async () => {
    addComment.mockResolvedValue({ data: null, error: 'Failed' });
    renderThread();
    await screen.findByText('Comment 1 <b>raw</b>');

    fireEvent.change(screen.getByLabelText('writeComment'), { target: { value: 'Draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'postComment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('commentPostError');
    expect(screen.getByLabelText('writeComment')).toHaveValue('Draft');
  });

  it('deletes a comment after confirmation', async () => {
    deleteComment.mockResolvedValue({ data: { id: 2, deleted: true }, error: null });
    renderThread();
    await screen.findByText('Comment 2 <b>raw</b>');

    fireEvent.click(screen.getByRole('button', { name: 'deleteCommentBy Me' }));
    await screen.findByRole('heading', { name: 'deleteComment' });
    fireEvent.click(screen.getByRole('button', { name: 'delete' }));

    await waitFor(() => expect(screen.queryByText('Comment 2 <b>raw</b>')).not.toBeInTheDocument());
    expect(deleteComment).toHaveBeenCalledWith(8, 2);
    expect(screen.getByRole('button', { name: 'commentsCount 1' })).toBeInTheDocument();
  });

  it('keeps the comment and reports an error when deletion fails', async () => {
    deleteComment.mockResolvedValue({ data: null, error: 'Failed' });
    renderThread();
    await screen.findByText('Comment 2 <b>raw</b>');

    fireEvent.click(screen.getByRole('button', { name: 'deleteCommentBy Me' }));
    await screen.findByRole('heading', { name: 'deleteComment' });
    fireEvent.click(screen.getByRole('button', { name: 'delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('commentDeleteError');
    expect(screen.getByText('Comment 2 <b>raw</b>')).toBeInTheDocument();
  });

  it('shows the empty state and the load error', async () => {
    fetchComments.mockResolvedValueOnce({ data: { comments: [], total: 0 }, error: null });
    renderThread(0);
    expect(await screen.findByText('commentsEmpty')).toBeInTheDocument();

    fetchComments.mockResolvedValueOnce({ data: null, error: 'Failed' });
    fireEvent.click(screen.getByRole('button', { name: 'commentsCount 0' }));
    fireEvent.click(screen.getByRole('button', { name: 'commentsCount 0' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('commentsLoadError');
    expect(screen.queryByLabelText('writeComment')).not.toBeInTheDocument();
  });

  it('likes comments by others and only shows the count on your own', async () => {
    setCommentLike.mockResolvedValue({ data: { liked: true, likeCount: 3 }, error: null });
    renderThread();
    await screen.findByText('Comment 1 <b>raw</b>');

    expect(screen.queryByRole('button', { name: /likeCommentBy Me/ })).not.toBeInTheDocument();
    const likeAda = screen.getByRole('button', { name: 'likeCommentBy Ada, likesCount 2' });
    expect(likeAda).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(likeAda);

    expect(await screen.findByRole('button', { name: 'likeCommentBy Ada, likesCount 3' })).toHaveAttribute('aria-pressed', 'true');
    expect(setCommentLike).toHaveBeenCalledWith(8, 1, true);
  });

  it('keeps the like state and reports an error when the update fails', async () => {
    setCommentLike.mockResolvedValue({ data: null, error: 'Failed' });
    renderThread();
    fireEvent.click(await screen.findByRole('button', { name: 'likeCommentBy Ada, likesCount 2' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('likeUpdateError');
    expect(screen.getByRole('button', { name: 'likeCommentBy Ada, likesCount 2' })).toBeEnabled();
  });
});
