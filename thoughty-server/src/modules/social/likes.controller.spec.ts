import { RATE_LIMITS } from '@/common';
import { LikesController } from './likes.controller';

const getThrottleMetadata = (handler: Function) => ({
  limit: Reflect.getMetadata('THROTTLER:LIMITdefault', handler),
  ttl: Reflect.getMetadata('THROTTLER:TTLdefault', handler),
});

describe('LikesController', () => {
  const service = { setEntryLike: jest.fn(), setCommentLike: jest.fn() };
  const controller = new LikesController(service as never);
  const user = { userId: 4 };

  afterEach(() => jest.clearAllMocks());

  it('delegates entry and comment likes with the authenticated user id', async () => {
    service.setEntryLike.mockResolvedValue({ liked: true, likeCount: 1 });
    service.setCommentLike.mockResolvedValue({ liked: false, likeCount: 0 });

    await expect(controller.likeEntry(user as never, 8)).resolves.toEqual({
      liked: true,
      likeCount: 1,
    });
    await controller.unlikeEntry(user as never, 8);
    await controller.likeComment(user as never, 8, 3);
    await expect(controller.unlikeComment(user as never, 8, 3)).resolves.toEqual({
      liked: false,
      likeCount: 0,
    });

    expect(service.setEntryLike.mock.calls).toEqual([
      [4, 8, true],
      [4, 8, false],
    ]);
    expect(service.setCommentLike.mock.calls).toEqual([
      [4, 8, 3, true],
      [4, 8, 3, false],
    ]);
  });

  it.each(['likeEntry', 'unlikeEntry', 'likeComment', 'unlikeComment'] as const)(
    'applies the social write throttle to %s',
    (method) => {
      expect(getThrottleMetadata(LikesController.prototype[method])).toEqual(
        RATE_LIMITS.socialWrite,
      );
    },
  );
});
