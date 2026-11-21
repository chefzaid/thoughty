import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTranslation } from '../../utils/translations';
import AccountActivitySection from './AccountActivitySection';

const list = vi.fn();
const setNewBrowserEmail = vi.fn();
const service = { list, setNewBrowserEmail };

vi.mock('../../hooks/useAuthenticatedService', () => ({
  useAuthenticatedService: () => service,
}));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const event = (id: number, kind: string, browser: string | null = 'Firefox', system: string | null = 'Windows') => ({
  id,
  kind,
  browser,
  system,
  createdAt: '2026-11-21T09:00:00.000Z',
});

describe('AccountActivitySection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists each event with what happened and its browser and system, and shows older ones on demand', async () => {
    list
      .mockResolvedValueOnce({
        data: { events: [event(9, 'sign_in_refused'), event(8, 'pin_set', null, null)], nextBefore: 8, newBrowserEmail: true },
        error: null,
      })
      .mockResolvedValueOnce({ data: { events: [event(3, 'sign_in', 'Safari', 'iOS')], nextBefore: null, newBrowserEmail: true }, error: null });
    render(<AccountActivitySection isDark t={t} />);

    const table = await screen.findByRole('table', { name: 'Account activity' });
    expect(within(table).getByText('Sign-in refused (wrong password or code)')).toBeInTheDocument();
    expect(within(table).getByText('Firefox on Windows')).toBeInTheDocument();
    expect(within(table).getByText('Unknown browser on unknown system')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show older activity' }));
    expect(await within(table).findByText('Safari on iOS')).toBeInTheDocument();
    expect(list).toHaveBeenLastCalledWith(8);
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'Show older activity' })).not.toBeInTheDocument();
  });

  it('says when nothing happened, and turns the new-browser email off', async () => {
    list.mockResolvedValue({ data: { events: [], nextBefore: null, newBrowserEmail: true }, error: null });
    setNewBrowserEmail.mockResolvedValue({ data: { newBrowserEmail: false }, error: null });
    render(<AccountActivitySection isDark={false} t={t} />);

    expect(await screen.findByText('Nothing has happened on your account in the past year.')).toBeInTheDocument();
    const toggle = screen.getByRole('switch', { name: 'Email me about a sign-in from a new browser' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);

    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    expect(setNewBrowserEmail).toHaveBeenCalledWith(false);
  });

  it('puts the switch back and says so when the setting cannot be saved', async () => {
    list.mockResolvedValue({ data: { events: [], nextBefore: null, newBrowserEmail: false }, error: null });
    setNewBrowserEmail.mockResolvedValue({ data: null, error: 'newBrowserEmailSaveError' });
    render(<AccountActivitySection isDark t={t} />);

    const toggle = await screen.findByRole('switch', { name: 'Email me about a sign-in from a new browser' });
    fireEvent.click(toggle);

    expect(await screen.findByRole('alert')).toHaveTextContent('This setting could not be saved.');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(setNewBrowserEmail).toHaveBeenCalledWith(true);
  });

  it('says when the activity cannot be loaded, first or older', async () => {
    list.mockResolvedValueOnce({ data: null, error: 'accountActivityLoadError' });
    const { unmount } = render(<AccountActivitySection isDark t={t} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The account activity could not be loaded.');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    unmount();

    list
      .mockResolvedValueOnce({ data: { events: [event(9, 'sign_in')], nextBefore: 9, newBrowserEmail: true }, error: null })
      .mockResolvedValueOnce({ data: null, error: 'accountActivityLoadError' });
    render(<AccountActivitySection isDark t={t} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Show older activity' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
    expect(screen.getByText('Signed in')).toBeInTheDocument();
  });
});
