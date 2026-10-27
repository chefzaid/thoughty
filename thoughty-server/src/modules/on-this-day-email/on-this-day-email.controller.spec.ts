import { OnThisDayEmailController } from './on-this-day-email.controller';

describe('OnThisDayEmailController', () => {
  const settings = { enabled: true, deliveryHour: 8, timeZone: 'UTC', diaryId: null, nextSendAt: null, emailAvailable: true };
  const service = {
    get: jest.fn().mockResolvedValue(settings),
    update: jest.fn().mockResolvedValue(settings),
    unsubscribe: jest.fn().mockResolvedValue({ success: true }),
  };
  const controller = new OnThisDayEmailController(service as never);
  const user = { userId: 3 } as never;

  it('reads and saves the signed-in writer’s setting', async () => {
    await expect(controller.get(user)).resolves.toBe(settings);
    expect(service.get).toHaveBeenCalledWith(3);

    const dto = { enabled: true, deliveryHour: 8, timeZone: 'UTC', diaryId: null };
    await expect(controller.update(user, dto)).resolves.toBe(settings);
    expect(service.update).toHaveBeenCalledWith(3, dto);
  });

  it('unsubscribes with the link’s token', async () => {
    await expect(controller.unsubscribe({ token: '3.abc' })).resolves.toEqual({ success: true });
    expect(service.unsubscribe).toHaveBeenCalledWith('3.abc');
  });
});
