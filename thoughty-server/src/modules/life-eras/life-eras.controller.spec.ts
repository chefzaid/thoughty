import { LifeErasController } from './life-eras.controller';

describe('LifeErasController', () => {
  const lifeErasService = {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const controller = new LifeErasController(lifeErasService as never);
  const user = { userId: 7, email: 'writer@example.com' };

  beforeEach(() => jest.clearAllMocks());

  it('passes every call on for the signed-in writer', async () => {
    lifeErasService.list.mockResolvedValue({ lifeEras: [], limit: 100 });
    lifeErasService.create.mockResolvedValue({ id: 1 });
    lifeErasService.update.mockResolvedValue({ id: 1, name: 'Lyon' });
    lifeErasService.delete.mockResolvedValue({ success: true });
    const dto = { name: 'University', startDate: '2010-09-01' };

    await expect(controller.list(user as never)).resolves.toEqual({ lifeEras: [], limit: 100 });
    expect(lifeErasService.list).toHaveBeenCalledWith(7);

    await expect(controller.create(user as never, dto)).resolves.toEqual({ id: 1 });
    expect(lifeErasService.create).toHaveBeenCalledWith(7, dto);

    await expect(controller.update(user as never, 1, { name: 'Lyon' })).resolves.toEqual({ id: 1, name: 'Lyon' });
    expect(lifeErasService.update).toHaveBeenCalledWith(7, 1, { name: 'Lyon' });

    await expect(controller.delete(user as never, 1)).resolves.toEqual({ success: true });
    expect(lifeErasService.delete).toHaveBeenCalledWith(7, 1);
  });
});
