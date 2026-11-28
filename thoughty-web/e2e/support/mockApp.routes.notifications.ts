import { fulfillJson, type RouteContext } from './mockApp.route-utils';
import { messageNotifications } from './mockApp.routes.messages';
import type { MockAppState } from './mockApp.shared';

/**
 * Notifications: `state.notifications` as seeded and one per conversation with unread messages, newest first;
 * opening them marks every one read.
 */
const allNotifications = (state: MockAppState) =>
  [...state.notifications, ...messageNotifications(state)].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
const unreadCount = (state: MockAppState) => allNotifications(state).filter((notification) => notification.unread).length;

export async function handleNotificationRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/notifications' && request.method() === 'GET') {
    await fulfillJson(route, { notifications: allNotifications(state), unreadCount: unreadCount(state) });
    return true;
  }
  if (pathname === '/api/notifications/unread' && request.method() === 'GET') {
    await fulfillJson(route, { unreadCount: unreadCount(state) });
    return true;
  }
  if (pathname === '/api/notifications/read' && request.method() === 'PUT') {
    state.notifications = state.notifications.map((notification) => ({ ...notification, unread: false }));
    state.messages.notificationsReadAt = new Date().toISOString();
    await fulfillJson(route, { unreadCount: 0 });
    return true;
  }
  return false;
}
