import { MonthlyRecapEmailController } from './monthly-recap-email.controller';

describe('MonthlyRecapEmailController', () => {
  it('reads and saves the signed-in writer’s setting', async () => {
    const settings = { enabled: true, deliveryHour: 8, timeZone: 'UTC', diaryId: null, nextSendAt: null, emailAvailable: true };
    const service = { get: jest.fn().mockResolvedValue(settings), update: jest.fn().mockResolvedValue(settings) };
    const controller = new MonthlyRecapEmailController(service as never);
    const user = { userId: 3 } as never;

    await expect(controller.get(user)).resolves.toBe(settings);
    expect(service.get).toHaveBeenCalledWith(3);

    const dto = { enabled: true, deliveryHour: 8, timeZone: 'UTC', diaryId: null };
    await expect(controller.update(user, dto)).resolves.toBe(settings);
    expect(service.update).toHaveBeenCalledWith(3, dto);
  });
});
