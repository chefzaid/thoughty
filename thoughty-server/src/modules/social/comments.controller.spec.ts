import { RATE_LIMITS } from '@/common';
import { CommentsController } from './comments.controller';
import { FollowsController } from './follows.controller';

const getThrottleMetadata = (handler: Function) => ({
  limit: Reflect.getMetadata('THROTTLER:LIMITdefault', handler),
  ttl: Reflect.getMetadata('THROTTLER:TTLdefault', handler),
});

describe('CommentsController', () => {
  const service = { list: jest.fn(), create: jest.fn(), remove: jest.fn() };
  const controller = new CommentsController(service as never);
  const user = { userId: 4 };

  afterEach(() => jest.clearAllMocks());

  it('delegates listing, creation, and deletion with the authenticated user id', async () => {
    service.list.mockResolvedValue({ comments: [], total: 0 });
    service.create.mockResolvedValue({ id: 3 });
    service.remove.mockResolvedValue({ id: 3, deleted: true });

    await expect(controller.list(user as never, 8)).resolves.toEqual({ comments: [], total: 0 });
    await expect(controller.create(user as never, 8, { content: 'Hi' })).resolves.toEqual({
      id: 3,
    });
    await expect(controller.remove(user as never, 8, 3)).resolves.toEqual({
      id: 3,
      deleted: true,
    });
    expect(service.list).toHaveBeenCalledWith(4, 8);
    expect(service.create).toHaveBeenCalledWith(4, 8, 'Hi');
    expect(service.remove).toHaveBeenCalledWith(4, 8, 3);
  });

  it.each([
    [CommentsController.prototype.create],
    [CommentsController.prototype.remove],
    [FollowsController.prototype.follow],
    [FollowsController.prototype.unfollow],
  ])('applies the social write throttle', (handler) => {
    expect(getThrottleMetadata(handler)).toEqual(RATE_LIMITS.socialWrite);
  });
});
