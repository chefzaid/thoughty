import { RATE_LIMITS } from '@/common';
import { CommentControlsController } from './comment-controls.controller';

describe('CommentControlsController', () => {
  const service = { setPolicy: jest.fn(), setHidden: jest.fn(), setPinned: jest.fn() };
  const controller = new CommentControlsController(service as never);
  const user = { userId: 4 };

  afterEach(() => jest.clearAllMocks());

  it('sets the policy, hides and pins for the authenticated user', async () => {
    service.setPolicy.mockResolvedValue({ commentPolicy: 'closed', canComment: false });
    service.setHidden.mockResolvedValue({ id: 3 });
    service.setPinned.mockResolvedValue({ id: 3 });

    await expect(controller.setPolicy(user as never, 8, { policy: 'closed' })).resolves.toEqual({
      commentPolicy: 'closed',
      canComment: false,
    });
    await controller.hide(user as never, 8, 3);
    await controller.show(user as never, 8, 3);
    await controller.pin(user as never, 8, 3);
    await controller.unpin(user as never, 8, 3);

    expect(service.setPolicy).toHaveBeenCalledWith(4, 8, 'closed');
    expect(service.setHidden.mock.calls).toEqual([
      [4, 8, 3, true],
      [4, 8, 3, false],
    ]);
    expect(service.setPinned.mock.calls).toEqual([
      [4, 8, 3, true],
      [4, 8, 3, false],
    ]);
  });

  it('limits each change like the other social writes', () => {
    for (const handler of [
      controller.setPolicy,
      controller.hide,
      controller.show,
      controller.pin,
      controller.unpin,
    ]) {
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(
        RATE_LIMITS.socialWrite.limit,
      );
      expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(
        RATE_LIMITS.socialWrite.ttl,
      );
    }
  });
});
