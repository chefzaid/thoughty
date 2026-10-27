import { PeopleController } from './people.controller';

describe('PeopleController', () => {
  const peopleService = { list: jest.fn(), rename: jest.fn(), merge: jest.fn(), delete: jest.fn() };
  const controller = new PeopleController(peopleService as never);
  const user = { userId: 7, email: 'writer@example.com' };

  beforeEach(() => jest.clearAllMocks());

  it('passes every call on for the signed-in writer', async () => {
    peopleService.list.mockResolvedValue({ people: [], limit: 1000 });
    peopleService.rename.mockResolvedValue({ id: 12, name: 'Marie Curie' });
    peopleService.merge.mockResolvedValue({ id: 12, name: 'Marie' });
    peopleService.delete.mockResolvedValue({ success: true });

    await expect(controller.list(user as never)).resolves.toEqual({ people: [], limit: 1000 });
    expect(peopleService.list).toHaveBeenCalledWith(7);

    await expect(controller.rename(user as never, 12, { name: 'Marie Curie' })).resolves.toEqual({ id: 12, name: 'Marie Curie' });
    expect(peopleService.rename).toHaveBeenCalledWith(7, 12, { name: 'Marie Curie' });

    await expect(controller.merge(user as never, 12, { duplicateId: 14 })).resolves.toEqual({ id: 12, name: 'Marie' });
    expect(peopleService.merge).toHaveBeenCalledWith(7, 12, { duplicateId: 14 });

    await expect(controller.delete(user as never, 12)).resolves.toEqual({ success: true });
    expect(peopleService.delete).toHaveBeenCalledWith(7, 12);
  });
});
