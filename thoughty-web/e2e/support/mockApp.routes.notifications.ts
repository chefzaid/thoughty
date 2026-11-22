import { fulfillJson, type RouteContext } from './mockApp.route-utils';
import type { MockAppState } from './mockApp.shared';

/** Notifications: `state.notifications` as seeded, newest first; opening them marks every one read. */
const unreadCount = (state: MockAppState) => state.notifications.filter((notification) => notification.unread).length;

export async function handleNotificationRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/notifications' && request.method() === 'GET') {
    await fulfillJson(route, { notifications: state.notifications, unreadCount: unreadCount(state) });
    return true;
  }
  if (pathname === '/api/notifications/unread' && request.method() === 'GET') {
    await fulfillJson(route, { unreadCount: unreadCount(state) });
    return true;
  }
  if (pathname === '/api/notifications/read' && request.method() === 'PUT') {
    state.notifications = state.notifications.map((notification) => ({ ...notification, unread: false }));
    await fulfillJson(route, { unreadCount: 0 });
    return true;
  }
  return false;
}
