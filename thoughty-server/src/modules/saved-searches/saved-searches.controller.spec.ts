import { SavedSearchesController } from './saved-searches.controller';

describe('SavedSearchesController', () => {
  const savedSearchesService = {
    list: jest.fn(),
    create: jest.fn(),
    rename: jest.fn(),
    delete: jest.fn(),
  };
  const controller = new SavedSearchesController(savedSearchesService as never);
  const user = { userId: 7, email: 'writer@example.com' };

  beforeEach(() => jest.clearAllMocks());

  it('passes every call on for the signed-in writer', async () => {
    savedSearchesService.list.mockResolvedValue({ savedSearches: [], limit: 50 });
    savedSearchesService.create.mockResolvedValue({ id: 1 });
    savedSearchesService.rename.mockResolvedValue({ id: 1, name: 'Renamed' });
    savedSearchesService.delete.mockResolvedValue({ success: true });
    const dto = { name: 'Family', diaryId: null, filters: {} };

    await expect(controller.list(user as never)).resolves.toEqual({ savedSearches: [], limit: 50 });
    expect(savedSearchesService.list).toHaveBeenCalledWith(7);

    await expect(controller.create(user as never, dto as never)).resolves.toEqual({ id: 1 });
    expect(savedSearchesService.create).toHaveBeenCalledWith(7, dto);

    await expect(controller.rename(user as never, 1, { name: 'Renamed' })).resolves.toEqual({ id: 1, name: 'Renamed' });
    expect(savedSearchesService.rename).toHaveBeenCalledWith(7, 1, { name: 'Renamed' });

    await expect(controller.delete(user as never, 1)).resolves.toEqual({ success: true });
    expect(savedSearchesService.delete).toHaveBeenCalledWith(7, 1);
  });
});
