import { RereadRemindersController } from './reread-reminders.controller';

describe('RereadRemindersController', () => {
  const service = { set: jest.fn(), clear: jest.fn() };
  const controller = new RereadRemindersController(service as never);
  const user = { userId: 7, email: 'writer@example.com' };
  const entry = { id: 4, userId: 7, date: '2026-01-02', index: 1, content: 'Moving day', tags: [], sealedUntil: null };

  it('sets the reminder for the signed-in writer and answers the entry', async () => {
    service.set.mockResolvedValue({ ...entry, rereadOn: '2026-11-07' });

    await expect(controller.set(user as never, 4, { rereadOn: '2026-11-07', today: '2026-10-31' })).resolves.toEqual({
      success: true,
      entry: expect.objectContaining({ id: 4, reread_on: '2026-11-07' }),
    });
    expect(service.set).toHaveBeenCalledWith(7, 4, '2026-11-07', '2026-10-31');
  });

  it('clears it', async () => {
    service.clear.mockResolvedValue({ ...entry, rereadOn: null });

    await expect(controller.clear(user as never, 4)).resolves.toEqual({
      success: true,
      entry: expect.objectContaining({ id: 4, reread_on: null }),
    });
    expect(service.clear).toHaveBeenCalledWith(7, 4);
  });
});
