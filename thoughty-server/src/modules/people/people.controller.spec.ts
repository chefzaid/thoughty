import { PeopleController } from './people.controller';

describe('PeopleController', () => {
  const peopleService = { list: jest.fn(), update: jest.fn(), markContacted: jest.fn(), merge: jest.fn(), delete: jest.fn() };
  const controller = new PeopleController(peopleService as never);
  const user = { userId: 7, email: 'writer@example.com' };

  beforeEach(() => jest.clearAllMocks());

  it('passes every call on for the signed-in writer', async () => {
    peopleService.list.mockResolvedValue({ people: [], limit: 1000 });
    peopleService.update.mockResolvedValue({ id: 12, name: 'Marie Curie' });
    peopleService.markContacted.mockResolvedValue({ id: 12, lastContactOn: '2026-11-22' });
    peopleService.merge.mockResolvedValue({ id: 12, name: 'Marie' });
    peopleService.delete.mockResolvedValue({ success: true });

    await expect(controller.list(user as never)).resolves.toEqual({ people: [], limit: 1000 });
    expect(peopleService.list).toHaveBeenCalledWith(7);

    await expect(controller.update(user as never, 12, { name: 'Marie Curie' })).resolves.toEqual({ id: 12, name: 'Marie Curie' });
    expect(peopleService.update).toHaveBeenCalledWith(7, 12, { name: 'Marie Curie' });

    await expect(controller.markContacted(user as never, 12, { today: '2026-11-22' })).resolves.toEqual({ id: 12, lastContactOn: '2026-11-22' });
    expect(peopleService.markContacted).toHaveBeenCalledWith(7, 12, '2026-11-22');

    await expect(controller.merge(user as never, 12, { duplicateId: 14 })).resolves.toEqual({ id: 12, name: 'Marie' });
    expect(peopleService.merge).toHaveBeenCalledWith(7, 12, { duplicateId: 14 });

    await expect(controller.delete(user as never, 12)).resolves.toEqual({ success: true });
    expect(peopleService.delete).toHaveBeenCalledWith(7, 12);
  });
});
