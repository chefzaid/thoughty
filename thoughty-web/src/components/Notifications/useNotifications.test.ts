import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NOTIFICATIONS_POLL_MS, useNotifications } from './useNotifications';

const service = { list: vi.fn(), countUnread: vi.fn(), markRead: vi.fn() };

vi.mock('../../hooks/useAuthenticatedService', () => ({
  useAuthenticatedService: () => service,
}));

const notification = {
  id: 'follow:2',
  type: 'follow' as const,
  createdAt: '2026-11-21T08:30:00.000Z',
  unread: true,
  actor: { id: 2, username: 'maya', avatarUrl: null },
  entry: null,
  comment: null,
};

const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
};

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setVisibility('visible');
    service.countUnread.mockResolvedValue({ data: { unreadCount: 2 }, error: null });
    service.markRead.mockResolvedValue({ data: { unreadCount: 0 }, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    setVisibility('visible');
  });

  it('reads how many are new on mount, every minute while in front, and when the page comes back', async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useNotifications());
    await act(async () => undefined);
    expect(result.current.unreadCount).toBe(2);
    expect(service.countUnread).toHaveBeenCalledTimes(1);

    service.countUnread.mockResolvedValue({ data: { unreadCount: 3 }, error: null });
    await act(async () => {
      vi.advanceTimersByTime(NOTIFICATIONS_POLL_MS);
    });
    expect(result.current.unreadCount).toBe(3);

    // Behind another tab it waits, and reads again when shown
    setVisibility('hidden');
    await act(async () => {
      vi.advanceTimersByTime(NOTIFICATIONS_POLL_MS);
    });
    expect(service.countUnread).toHaveBeenCalledTimes(2);
    setVisibility('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });
    expect(service.countUnread).toHaveBeenCalledTimes(4);

    unmount();
    vi.advanceTimersByTime(NOTIFICATIONS_POLL_MS);
    expect(service.countUnread).toHaveBeenCalledTimes(4);
  });

  it('keeps the count when it cannot be read', async () => {
    service.countUnread.mockResolvedValue({ data: null, error: 'notificationsLoadError' });
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(service.countUnread).toHaveBeenCalled());
    expect(result.current.unreadCount).toBe(0);
  });

  it('loads the list, then marks it read, which clears the count', async () => {
    service.list.mockResolvedValue({ data: { notifications: [notification], unreadCount: 2 }, error: null });
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    await act(() => result.current.load());

    expect(result.current.notifications).toEqual([notification]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(service.markRead).toHaveBeenCalledTimes(1);
  });

  it('marks nothing read when nothing is new', async () => {
    service.countUnread.mockResolvedValue({ data: { unreadCount: 0 }, error: null });
    service.list.mockResolvedValue({ data: { notifications: [], unreadCount: 0 }, error: null });
    const { result } = renderHook(() => useNotifications());

    await act(() => result.current.load());

    expect(result.current.notifications).toEqual([]);
    expect(service.markRead).not.toHaveBeenCalled();
  });

  it('does not let a count read before a load bring the cleared count back', async () => {
    let answerCount: (value: unknown) => void = () => undefined;
    service.countUnread.mockReturnValueOnce(new Promise((resolve) => { answerCount = resolve; }));
    service.list.mockResolvedValue({ data: { notifications: [notification], unreadCount: 2 }, error: null });
    const { result } = renderHook(() => useNotifications());

    await act(() => result.current.load());
    await act(async () => answerCount({ data: { unreadCount: 2 }, error: null }));

    expect(result.current.unreadCount).toBe(0);
  });

  it('says when the list could not be loaded, keeping the count', async () => {
    service.list.mockResolvedValue({ data: null, error: 'notificationsLoadError' });
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    await act(() => result.current.load());

    expect(result.current.error).toBe('notificationsLoadError');
    expect(result.current.unreadCount).toBe(2);
    expect(service.markRead).not.toHaveBeenCalled();
  });

  it('ignores a list that answers after the page closed', async () => {
    let answer: (value: unknown) => void = () => undefined;
    service.list.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    const { result, unmount } = renderHook(() => useNotifications());

    const loading = result.current.load();
    unmount();
    answer({ data: { notifications: [], unreadCount: 1 }, error: null });
    await loading;

    expect(service.markRead).not.toHaveBeenCalled();
  });
});
