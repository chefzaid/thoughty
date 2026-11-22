import { RATE_LIMITS } from '@/common';
import { NotificationsController } from './notifications.controller';

describe('NotificationsController', () => {
  const service = { list: jest.fn(), countUnread: jest.fn(), markRead: jest.fn() };
  const controller = new NotificationsController(service as never);
  const user = { userId: 4 };

  afterEach(() => jest.clearAllMocks());

  it('lists, counts and marks read the notifications of the authenticated user', async () => {
    service.list.mockResolvedValue({ notifications: [], unreadCount: 2 });
    service.countUnread.mockResolvedValue(2);
    service.markRead.mockResolvedValue(undefined);

    await expect(controller.list(user as never)).resolves.toEqual({ notifications: [], unreadCount: 2 });
    await expect(controller.countUnread(user as never)).resolves.toEqual({ unreadCount: 2 });
    await expect(controller.markRead(user as never)).resolves.toEqual({ unreadCount: 0 });
    expect(service.list).toHaveBeenCalledWith(4);
    expect(service.countUnread).toHaveBeenCalledWith(4);
    expect(service.markRead).toHaveBeenCalledWith(4);
  });

  it('limits marking read like the other social writes', () => {
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', controller.markRead)).toBe(RATE_LIMITS.socialWrite.limit);
  });
});
