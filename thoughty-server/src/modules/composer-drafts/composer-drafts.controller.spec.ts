import { ComposerDraftsController } from './composer-drafts.controller';

describe('ComposerDraftsController', () => {
  const draftsService = { get: jest.fn(), save: jest.fn(), discard: jest.fn() };
  const controller = new ComposerDraftsController(draftsService as never);
  const user = { userId: 7, email: 'writer@example.com' };

  beforeEach(() => jest.clearAllMocks());

  it('passes every call on for the signed-in writer', async () => {
    draftsService.get.mockResolvedValue({ draft: null });
    draftsService.save.mockResolvedValue({ revision: 1 });
    draftsService.discard.mockResolvedValue({ success: true });
    const dto = { text: 'Hello', title: null, tags: [], format: 'plain', mood: null, feelings: [], baseRevision: null };

    await expect(controller.get(user as never)).resolves.toEqual({ draft: null });
    expect(draftsService.get).toHaveBeenCalledWith(7);

    await expect(controller.save(user as never, dto as never)).resolves.toEqual({ revision: 1 });
    expect(draftsService.save).toHaveBeenCalledWith(7, dto);

    await expect(controller.discard(user as never, { revision: 2 })).resolves.toEqual({ success: true });
    expect(draftsService.discard).toHaveBeenCalledWith(7, 2);
    await controller.discard(user as never, {});
    expect(draftsService.discard).toHaveBeenLastCalledWith(7, undefined);
  });
});
