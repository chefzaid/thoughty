import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RecycleBinPage as RecycleBinPageData, TrashedEntry } from '../../services/api';
import { createTestQueryClient } from '../../test/queryClient';
import RecycleBinPage, { type RecycleBinPageProps } from './RecycleBinPage';

const recycleBinService = {
  fetchPage: vi.fn(),
  restore: vi.fn(),
  restoreAll: vi.fn(),
  deletePermanently: vi.fn(),
  empty: vi.fn(),
};

vi.mock('../../hooks/useAuthenticatedService', () => ({
  useAuthenticatedService: () => recycleBinService,
}));

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${Object.values(params).join(' | ')}` : key;

const trashed = (overrides: Partial<TrashedEntry> = {}): TrashedEntry => ({
  id: 12,
  date: '2026-10-21',
  content: '## Harbor\n\nWalked by the **harbor** before work.',
  format: 'markdown',
  tags: ['walks'],
  diaryId: 2,
  diaryName: 'Travel',
  diaryIcon: '🧭',
  diaryColor: '#2A9D8F',
  attachmentCount: 2,
  deletedAt: new Date().toISOString(),
  purgeAt: new Date(Date.now() + 29.5 * 24 * 60 * 60 * 1000).toISOString(),
  ...overrides,
});

const binPage = (overrides: Partial<RecycleBinPageData> = {}): RecycleBinPageData => ({
  entries: [trashed(), trashed({ id: 13, date: '2026-10-19', diaryId: null, diaryName: null, diaryIcon: null, diaryColor: null, attachmentCount: 0, tags: [] })],
  total: 2,
  page: 1,
  totalPages: 1,
  retentionDays: 30,
  ...overrides,
});

function renderPage(props: Partial<RecycleBinPageProps> = {}) {
  const handlers = { onChangePage: vi.fn(), onBack: vi.fn() };
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RecycleBinPage
        language="en"
        diaries={[{ id: 1, name: 'Journal', icon: '📓', visibility: 'private', is_default: true }]}
        page={1}
        t={t}
        {...handlers}
        {...props}
      />
    </QueryClientProvider>,
  );
  return handlers;
}

describe('RecycleBinPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recycleBinService.fetchPage.mockResolvedValue({ data: binPage(), error: null });
  });

  it('lists deleted entries with where they return, when they go, and their files', async () => {
    const { onBack } = renderPage();

    const harbor = await screen.findByRole('article', { name: 'October 21, 2026' });
    expect(recycleBinService.fetchPage).toHaveBeenCalledWith(1, 20);
    expect(screen.getByText('recycleBinCount recycleBinEntries_other 2')).toBeInTheDocument();
    expect(within(harbor).getByText('Harbor Walked by the harbor before work.')).toBeInTheDocument();
    expect(within(harbor).getByText('recycleBinReturnsTo 🧭 Travel')).toBeInTheDocument();
    expect(within(harbor).getByText('recycleBinDaysLeft_other 30')).toBeInTheDocument();
    expect(within(harbor).getByText('recycleBinFiles_other 2')).toBeInTheDocument();
    expect(within(harbor).getByText('#walks')).toBeInTheDocument();

    const orphan = screen.getByRole('article', { name: 'October 19, 2026' });
    expect(within(orphan).getByText('recycleBinReturnsToDefault Journal')).toBeInTheDocument();
    expect(within(orphan).queryByText(/recycleBinFiles/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'recycleBinBack' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('restores one entry and says where entries without a diary went', async () => {
    recycleBinService.restore.mockResolvedValue({ data: { success: true, restoredCount: 1, movedToDefaultCount: 1 }, error: null });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'recycleBinRestoreEntry October 19, 2026' }));

    expect(await screen.findByText(
      'recycleBinRestored recycleBinEntries_one 1 recycleBinMovedToDefault recycleBinEntries_one 1 | Journal',
    )).toBeInTheDocument();
    expect(recycleBinService.restore).toHaveBeenCalledWith([13]);
    await waitFor(() => expect(recycleBinService.fetchPage).toHaveBeenCalledTimes(2));
  });

  it('restores the whole bin at once', async () => {
    recycleBinService.restoreAll.mockResolvedValue({ data: { success: true, restoredCount: 2, movedToDefaultCount: 0 }, error: null });
    renderPage();
    await screen.findByRole('article', { name: 'October 21, 2026' });

    fireEvent.click(screen.getByRole('button', { name: 'recycleBinRestoreAll' }));

    expect(await screen.findByText('recycleBinRestored recycleBinEntries_other 2')).toBeInTheDocument();
  });

  it('deletes an entry for good only after confirming', async () => {
    recycleBinService.deletePermanently.mockResolvedValue({ data: { success: true, deletedCount: 1 }, error: null });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'recycleBinDeleteEntry October 21, 2026' }));
    expect(screen.getByText('recycleBinDeleteMessage October 21, 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));
    expect(recycleBinService.deletePermanently).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'recycleBinDeleteEntry October 21, 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'recycleBinDeleteForever' }));

    expect(await screen.findByText('recycleBinDeleted recycleBinEntries_one 1')).toBeInTheDocument();
    expect(recycleBinService.deletePermanently).toHaveBeenCalledWith([12]);
  });

  it('empties the bin after confirming, and reports a failure', async () => {
    recycleBinService.empty.mockResolvedValue({ data: null, error: 'Failed to empty the recycle bin' });
    renderPage();
    await screen.findByRole('article', { name: 'October 21, 2026' });

    fireEvent.click(screen.getByRole('button', { name: 'recycleBinEmpty' }));
    expect(screen.getByText('recycleBinEmptyMessage recycleBinEntries_other 2')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('heading', { name: 'recycleBinEmptyTitle' }).parentElement as HTMLElement)
      .getByRole('button', { name: 'recycleBinEmpty' }));

    expect(await screen.findByText('recycleBinActionError')).toBeInTheDocument();
    expect(recycleBinService.empty).toHaveBeenCalled();
  });

  it('shows an empty bin with nothing to restore or empty', async () => {
    recycleBinService.fetchPage.mockResolvedValue({ data: binPage({ entries: [], total: 0 }), error: null });
    renderPage();

    expect(await screen.findByText('recycleBinEmptyState 30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'recycleBinRestoreAll' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'recycleBinEmpty' })).toBeDisabled();
  });

  it('pages through a long bin and steps back from a page that emptied', async () => {
    recycleBinService.fetchPage.mockResolvedValue({ data: binPage({ total: 45, page: 2, totalPages: 3 }), error: null });
    const { onChangePage } = renderPage({ page: 2 });

    const pages = await screen.findByRole('navigation', { name: 'recycleBinPagination' });
    expect(within(pages).getByText('recycleBinPage 2 | 3')).toBeInTheDocument();
    fireEvent.click(within(pages).getByRole('button', { name: 'recycleBinNext' }));
    expect(onChangePage).toHaveBeenLastCalledWith(3);
    fireEvent.click(within(pages).getByRole('button', { name: 'recycleBinPrevious' }));
    expect(onChangePage).toHaveBeenLastCalledWith(1);
  });

  it('moves to the last page when the requested one no longer exists', async () => {
    recycleBinService.fetchPage.mockResolvedValue({ data: binPage({ total: 2, page: 4, totalPages: 1, entries: [] }), error: null });
    const { onChangePage } = renderPage({ page: 4 });

    await waitFor(() => expect(onChangePage).toHaveBeenCalledWith(1, { replace: true }));
  });

  it('offers to try again when the bin cannot be loaded', async () => {
    recycleBinService.fetchPage.mockResolvedValueOnce({ data: null, error: 'down' }).mockResolvedValue({ data: binPage(), error: null });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'recycleBinRetry' }));

    expect(await screen.findByRole('article', { name: 'October 21, 2026' })).toBeInTheDocument();
  });
});
