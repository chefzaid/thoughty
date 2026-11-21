import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTranslation } from '../../utils/translations';
import HiddenWritersSection from './HiddenWritersSection';

const fetchHiddenWriters = vi.fn();
const setWriterMuted = vi.fn();
const setWriterBlocked = vi.fn();
const feedService = { fetchHiddenWriters, setWriterMuted, setWriterBlocked };

vi.mock('../../hooks/useFeedService', () => ({
  useFeedService: () => feedService,
}));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const writer = (id: number, username: string) => ({ id, username, avatarUrl: null, since: '2026-09-01T08:00:00.000Z' });

describe('HiddenWritersSection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists muted and blocked writers, each to undo', async () => {
    fetchHiddenWriters.mockResolvedValue({ data: { muted: [writer(2, 'Maya')], blocked: [writer(3, 'Noor')] }, error: null });
    setWriterMuted.mockResolvedValue({ data: { userId: 2, muted: false }, error: null });
    setWriterBlocked.mockResolvedValue({ data: { userId: 3, blocked: false }, error: null });
    render(<HiddenWritersSection isDark t={t} />);

    const muted = await screen.findByRole('list', { name: 'Muted' });
    const blocked = screen.getByRole('list', { name: 'Blocked' });
    fireEvent.click(within(muted).getByRole('button', { name: 'Unmute Maya' }));
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Muted' })).not.toBeInTheDocument());
    expect(setWriterMuted).toHaveBeenCalledWith(2, false);

    fireEvent.click(within(blocked).getByRole('button', { name: 'Unblock Noor' }));
    expect(await screen.findByText('You have not muted or blocked anyone.')).toBeInTheDocument();
    expect(setWriterBlocked).toHaveBeenCalledWith(3, false);
  });

  it('says when the list cannot be loaded or a change cannot be saved', async () => {
    fetchHiddenWriters.mockResolvedValueOnce({ data: null, error: 'hiddenWritersLoadError' });
    const { unmount } = render(<HiddenWritersSection isDark={false} t={t} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The muted and blocked writers could not be loaded.');
    unmount();

    fetchHiddenWriters.mockResolvedValueOnce({ data: { muted: [], blocked: [writer(3, 'Noor')] }, error: null });
    setWriterBlocked.mockResolvedValue({ data: null, error: 'writerBlockError' });
    render(<HiddenWritersSection isDark={false} t={t} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Unblock Noor' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This change could not be saved.');
    expect(screen.getByRole('button', { name: 'Unblock Noor' })).toBeEnabled();
  });

  it('treats an unexpected answer as a load error', async () => {
    fetchHiddenWriters.mockResolvedValue({ data: {}, error: null });
    render(<HiddenWritersSection isDark t={t} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
});
