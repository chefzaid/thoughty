import { RecycleBinController } from './recycle-bin.controller';

describe('RecycleBinController', () => {
  const recycleBinService = {
    list: jest.fn(),
    restore: jest.fn(),
    deletePermanently: jest.fn(),
  };
  const controller = new RecycleBinController(recycleBinService as never);
  const user = { userId: 7, email: 'writer@example.com' };

  beforeEach(() => jest.clearAllMocks());

  it('lists a page of the writer’s bin', async () => {
    recycleBinService.list.mockResolvedValue({ entries: [], total: 0 });

    await expect(controller.list(user as never, { page: 2, limit: 10 })).resolves.toEqual({ entries: [], total: 0 });
    expect(recycleBinService.list).toHaveBeenCalledWith(7, 2, 10);
  });

  it('restores the chosen entries or the whole bin', async () => {
    recycleBinService.restore.mockResolvedValue({ success: true, restoredCount: 2, movedToDefaultCount: 0 });

    await controller.restore(user as never, { ids: [3, 4] });
    expect(recycleBinService.restore).toHaveBeenLastCalledWith(7, [3, 4]);

    await controller.restoreAll(user as never);
    expect(recycleBinService.restore).toHaveBeenLastCalledWith(7);
  });

  it('deletes the chosen entries for good or empties the bin', async () => {
    recycleBinService.deletePermanently.mockResolvedValueOnce(2).mockResolvedValueOnce(5);

    await expect(controller.deletePermanently(user as never, { ids: [3, 4] })).resolves.toEqual({
      success: true,
      deletedCount: 2,
    });
    expect(recycleBinService.deletePermanently).toHaveBeenLastCalledWith(7, [3, 4]);

    await expect(controller.empty(user as never)).resolves.toEqual({ success: true, deletedCount: 5 });
    expect(recycleBinService.deletePermanently).toHaveBeenLastCalledWith(7);
  });
});
