import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createNotificationsService, type AppNotification } from '../../services/api';

/** How often the count of new notifications is read again while the page is in front. */
export const NOTIFICATIONS_POLL_MS = 60_000;

export interface NotificationsState {
  /** How many notifications came since they were last opened. */
  readonly unreadCount: number;
  /** The list as last loaded, each marked new or not as it was when loaded; null before the first load. */
  readonly notifications: readonly AppNotification[] | null;
  readonly loading: boolean;
  /** A translation key when the list could not be loaded. */
  readonly error: string | null;
  /** Loads the list, then marks everything read, which clears the count. */
  readonly load: () => Promise<void>;
}

/**
 * The writer's notifications: the count of new ones, read when the page opens, every minute while it is in
 * front and again when it comes back to the front, and the list, loaded when opened.
 */
export function useNotifications(): NotificationsState {
  const service = useAuthenticatedService(createNotificationsService);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<readonly AppNotification[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  /** Grows with every load, so a count read before a load answers cannot bring the cleared count back. */
  const loadsRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      const loads = loadsRef.current;
      void service.countUnread().then((result) => {
        if (mountedRef.current && result.data && loads === loadsRef.current) setUnreadCount(result.data.unreadCount);
      });
    };
    refresh();
    const timer = window.setInterval(refresh, NOTIFICATIONS_POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [service]);

  const load = useCallback(async () => {
    loadsRef.current += 1;
    setLoading(true);
    setError(null);
    const result = await service.list();
    if (!mountedRef.current) return;
    setLoading(false);
    if (!result.data) {
      setError(result.error ?? 'notificationsLoadError');
      return;
    }
    setNotifications(result.data.notifications);
    setUnreadCount(0);
    if (result.data.unreadCount > 0) await service.markRead();
  }, [service]);

  return { unreadCount, notifications, loading, error, load };
}
