import { WriterControlsController } from './writer-controls.controller';

describe('WriterControlsController', () => {
  const service = { list: jest.fn(), setMuted: jest.fn(), setBlocked: jest.fn() };
  const controller = new WriterControlsController(service as never);
  const user = { userId: 4 } as never;

  afterEach(() => jest.clearAllMocks());

  it('lists the muted and blocked writers of the authenticated user', async () => {
    service.list.mockResolvedValue({ muted: [], blocked: [] });

    await expect(controller.list(user)).resolves.toEqual({ muted: [], blocked: [] });
    expect(service.list).toHaveBeenCalledWith(4);
  });

  it('mutes and unmutes, blocks and unblocks for the authenticated user', async () => {
    service.setMuted.mockImplementation(async (_: number, userId: number, muted: boolean) => ({
      userId,
      muted,
    }));
    service.setBlocked.mockImplementation(async (_: number, userId: number, blocked: boolean) => ({
      userId,
      blocked,
    }));

    await expect(controller.mute(user, 9)).resolves.toEqual({ userId: 9, muted: true });
    await expect(controller.unmute(user, 9)).resolves.toEqual({ userId: 9, muted: false });
    await expect(controller.block(user, 9)).resolves.toEqual({ userId: 9, blocked: true });
    await expect(controller.unblock(user, 9)).resolves.toEqual({ userId: 9, blocked: false });
    expect(service.setMuted.mock.calls).toEqual([
      [4, 9, true],
      [4, 9, false],
    ]);
    expect(service.setBlocked.mock.calls).toEqual([
      [4, 9, true],
      [4, 9, false],
    ]);
  });
});
