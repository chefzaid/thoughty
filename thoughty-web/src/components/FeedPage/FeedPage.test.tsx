import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FeedPage from './FeedPage';

const fetchPublicFeed = vi.fn();
const feedService = { fetchPublicFeed };

vi.mock('../../hooks/useFeedService', () => ({
  useFeedService: () => feedService,
}));

const t = (key: string, params?: Record<string, string | number>) => {
  if (key === 'feedCount') return `${params?.count} of ${params?.total}`;
  return key;
};

const createEntry = (id: number, username: string) => ({
  id,
  date: '2026-08-01',
  index: 1,
  tags: ['notes'],
  content: `Entry ${id}`,
  format: 'plain' as const,
  createdAt: '2026-08-01T12:00:00.000Z',
  author: { id: id + 100, username, avatarUrl: null },
});

describe('FeedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
