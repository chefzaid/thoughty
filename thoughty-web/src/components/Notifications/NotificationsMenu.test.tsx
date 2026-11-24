import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import type { AppNotification } from '../../services/api';
import { withFeatureFlags } from '../../test/featureFlags';
import { QuietModeContext } from '../QuietMode/quietMode';
import { getTranslation } from '../../utils/translations';
import NotificationsMenu from './NotificationsMenu';
import { notificationIcon, notificationMessage } from './notificationMessage';

const service = { list: vi.fn(), countUnread: vi.fn(), markRead: vi.fn() };

vi.mock('../../hooks/useAuthenticatedService', () => ({
  useAuthenticatedService: () => service,
}));

const en = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const fr = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);

const actor = { id: 2, username: 'maya', avatarUrl: null };
const commentNotification: AppNotification = {
  id: 'comment:7',
  type: 'comment',
  createdAt: '2026-11-21T08:30:00.000Z',
  unread: true,
  actor,
  entry: { id: 42, date: '2026-11-20', index: 1, title: 'Morning walk' },
  comment: { id: 7, excerpt: 'What a lovely morning' },
};
const notifications: AppNotification[] = [
  commentNotification,
  {
    id: 'follow:3',
    type: 'follow',
    createdAt: '2026-11-20T08:30:00.000Z',
    unread: false,
    actor: { id: 3, username: 'sam', avatarUrl: null },
    entry: null,
    comment: null,
  },
];

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderMenu({ quiet = false, publicSharing = true, language = 'en' } = {}) {
  const Flags = withFeatureFlags({ publicSharing });
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <MemoryRouter initialEntries={['/journal']}>
      <Flags>
        <QuietModeContext.Provider value={quiet}>{children}</QuietModeContext.Provider>
      </Flags>
    </MemoryRouter>
  );
  return render(
    <Routes>
      <Route
        path="*"
        element={(
          <>
            <NotificationsMenu language={language} t={language === 'fr' ? fr : en} />
            <LocationProbe />
          </>
        )}
      />
    </Routes>,
    { wrapper },
  );
}

describe('NotificationsMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.countUnread.mockResolvedValue({ data: { unreadCount: 3 }, error: null });
    service.list.mockResolvedValue({ data: { notifications, unreadCount: 3 }, error: null });
    service.markRead.mockResolvedValue({ data: { unreadCount: 0 }, error: null });
  });

  it('shows how many are new, lists them when opened and marks them read', async () => {
    renderMenu();

    const bell = await screen.findByRole('button', { name: 'Notifications, 3 new' });
    expect(bell).toHaveTextContent('3');
    fireEvent.click(bell);

    const panel = await screen.findByRole('region', { name: 'Notifications' });
    expect(await within(panel).findByRole('button', { name: /maya commented on “Morning walk”/ })).toHaveTextContent(
      'What a lovely morning',
    );
    expect(within(panel).getByText('sam started following you')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: /sam/ })).not.toBeInTheDocument();
    expect(within(panel).getAllByText(/New/)).toHaveLength(1);
    await waitFor(() => expect(service.markRead).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Notifications', expanded: true })).not.toHaveTextContent('3');
  });

  it('opens the entry a notification is about in the feed, and closes', async () => {
    renderMenu();
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 3 new' }));

    fireEvent.click(await screen.findByRole('button', { name: /maya commented/ }));

    expect(screen.getByTestId('location')).toHaveTextContent('/feed?entry=42');
    expect(screen.getByRole('region', { hidden: true })).not.toBeVisible();
  });

  it('closes on Escape, giving the focus back to the bell, and when the focus leaves', async () => {
    renderMenu();
    const bell = await screen.findByRole('button', { name: 'Notifications, 3 new' });
    fireEvent.click(bell);
    await screen.findByRole('button', { name: /maya commented/ });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(bell).toHaveAttribute('aria-expanded', 'false');
    expect(bell).toHaveFocus();

    fireEvent.click(bell);
    fireEvent.blur(bell, { relatedTarget: document.body });
    expect(bell).toHaveAttribute('aria-expanded', 'false');
  });

  it('says only that something is new in quiet mode', async () => {
    renderMenu({ quiet: true });

    const bell = await screen.findByRole('button', { name: 'Notifications, some new' });
    expect(bell).not.toHaveTextContent(/\d/);
  });

  it('caps the count it shows', async () => {
    service.countUnread.mockResolvedValue({ data: { unreadCount: 120 }, error: null });
    renderMenu();

    expect(await screen.findByRole('button', { name: 'Notifications, 120 new' })).toHaveTextContent('99+');
  });

  it('says when there is nothing yet, and offers to try again when the list cannot load', async () => {
    service.countUnread.mockResolvedValue({ data: { unreadCount: 0 }, error: null });
    service.list.mockResolvedValueOnce({ data: { notifications: [], unreadCount: 0 }, error: null });
    renderMenu();
    const bell = await screen.findByRole('button', { name: 'Notifications' });
    fireEvent.click(bell);
    expect(await screen.findByText(/Nothing yet/)).toBeInTheDocument();
    fireEvent.click(bell);

    service.list.mockResolvedValueOnce({ data: null, error: 'notificationsLoadError' });
    fireEvent.click(bell);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Your notifications could not be loaded.');
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: /maya commented/ })).toBeInTheDocument();
  });

  it('is not there while public sharing is off', () => {
    renderMenu({ publicSharing: false });

    expect(screen.queryByRole('button', { name: /Notifications/ })).not.toBeInTheDocument();
    expect(service.countUnread).not.toHaveBeenCalled();
  });

  it('is in French too', async () => {
    renderMenu({ language: 'fr' });

    expect(await screen.findByRole('button', { name: 'Notifications, 3 nouvelles' })).toBeInTheDocument();
  });
});

describe('notificationMessage', () => {
  const base = commentNotification;

  it('names an entry by its title, or else by its day, yours or the one you commented on', () => {
    const untitled = { id: 42, date: '2026-11-20', index: 1, title: null };
    expect(notificationMessage({ ...base, type: 'entryLike', entry: untitled, comment: null }, 'en', en)).toBe(
      'maya liked your entry of November 20, 2026',
    );
    expect(notificationMessage({ ...base, type: 'commentLike', entry: untitled }, 'en', en)).toBe(
      'maya liked your comment on the entry of November 20, 2026',
    );
    expect(notificationMessage({ ...base, type: 'commentLike', entry: untitled }, 'fr', fr)).toBe(
      'maya a aimé votre commentaire sur l’entrée du 20 novembre 2026',
    );
    expect(notificationMessage(base, 'fr', fr)).toBe('maya a commenté « Morning walk »');
  });

  it('tells of a request to follow, and where to answer it', () => {
    const request = { ...base, id: 'followRequest:2', type: 'followRequest' as const, entry: null, comment: null };
    expect(notificationMessage(request, 'en', en)).toBe(
      'maya asks to follow you. Approve or decline in the feed’s Following tab',
    );
    expect(notificationMessage(request, 'fr', fr)).toBe(
      'maya demande à vous suivre. Approuvez ou refusez dans l’onglet Abonnements du fil',
    );
    expect(notificationIcon(request)).toBe('person-add');
  });
});
