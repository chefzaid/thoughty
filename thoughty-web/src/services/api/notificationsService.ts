import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type AppNotification = components['schemas']['NotificationDto'];
export type AppNotificationType = AppNotification['type'];
export type NotificationsPage = components['schemas']['NotificationsResponseDto'];
export type UnreadNotifications = components['schemas']['UnreadNotificationsDto'];

/** Comments, likes and new followers: the list, how many are new, and marking them read. Errors are translation keys. */
export const createNotificationsService = (authFetch: AuthFetchFunction) => ({
  list(): Promise<ServiceResult<NotificationsPage>> {
    return requestJson(authFetch('/api/notifications'), 'notificationsLoadError');
  },

  countUnread(): Promise<ServiceResult<UnreadNotifications>> {
    return requestJson(authFetch('/api/notifications/unread'), 'notificationsLoadError');
  },

  markRead(): Promise<ServiceResult<UnreadNotifications>> {
    return requestJson(authFetch('/api/notifications/read', { method: 'PUT' }), 'notificationsLoadError');
  },
});

export type NotificationsService = ReturnType<typeof createNotificationsService>;
