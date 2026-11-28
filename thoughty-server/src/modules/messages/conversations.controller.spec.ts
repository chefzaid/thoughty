import { RATE_LIMITS } from '@/common';
import { REQUIRED_FEATURE_KEY } from '@/common/feature-flags/require-feature.decorator';
import { ConversationsController } from './conversations.controller';

describe('ConversationsController', () => {
  const service = {
    list: jest.fn(),
    countUnread: jest.fn(),
    open: jest.fn(),
    thread: jest.fn(),
    send: jest.fn(),
    markRead: jest.fn(),
  };
  const controller = new ConversationsController(service as never);
  const user = { userId: 4 } as never;

  afterEach(() => jest.clearAllMocks());

  it('passes the authenticated writer and the ids to the service', async () => {
    service.list.mockResolvedValue({ conversations: [] });
    service.countUnread.mockResolvedValue({ unreadCount: 1 });
    service.open.mockResolvedValue({ id: 7 });
    service.thread.mockResolvedValue({ messages: [] });
    service.send.mockResolvedValue({ id: 9 });
    service.markRead.mockResolvedValue({ unreadCount: 0 });

    await expect(controller.list(user)).resolves.toEqual({ conversations: [] });
    await expect(controller.countUnread(user)).resolves.toEqual({ unreadCount: 1 });
    await expect(controller.open(user, 2)).resolves.toEqual({ id: 7 });
    await expect(controller.thread(user, 7, { before: 30 })).resolves.toEqual({ messages: [] });
    await expect(controller.send(user, 7, { body: 'Hello' })).resolves.toEqual({ id: 9 });
    await expect(controller.markRead(user, 7)).resolves.toEqual({ unreadCount: 0 });

    expect(service.list).toHaveBeenCalledWith(4);
    expect(service.countUnread).toHaveBeenCalledWith(4);
    expect(service.open).toHaveBeenCalledWith(4, 2);
    expect(service.thread).toHaveBeenCalledWith(4, 7, 30);
    expect(service.send).toHaveBeenCalledWith(4, 7, 'Hello');
    expect(service.markRead).toHaveBeenCalledWith(4, 7);
  });

  it('closes with public sharing and allows more reads and sends than other social writes', () => {
    expect(Reflect.getMetadata(REQUIRED_FEATURE_KEY, ConversationsController)).toBe(
      'publicSharing',
    );
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', controller.thread)).toBe(
      RATE_LIMITS.messagesRead.limit,
    );
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', controller.send)).toBe(
      RATE_LIMITS.messageWrite.limit,
    );
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', controller.open)).toBe(
      RATE_LIMITS.socialWrite.limit,
    );
  });
});
