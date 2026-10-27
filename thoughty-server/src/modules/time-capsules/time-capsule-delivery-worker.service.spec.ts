import { Logger } from '@nestjs/common';
import { TimeCapsuleDeliveryWorkerService } from './time-capsule-delivery-worker.service';

describe('TimeCapsuleDeliveryWorkerService', () => {
  beforeEach(() => jest.useFakeTimers());

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('opens and emails due capsules on start and every minute, naming them in its logs', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const delivery = { deliverDue: jest.fn().mockResolvedValueOnce(2).mockRejectedValueOnce(new Error('database down')) };
    const worker = new TimeCapsuleDeliveryWorkerService(delivery as never);

    await worker.start();
    expect(log).toHaveBeenCalledWith('Starting time capsule email delivery');
    expect(log).toHaveBeenCalledWith('Sent 2 time capsule emails');

    await jest.advanceTimersByTimeAsync(60_000);
    expect(error).toHaveBeenCalledWith('Failed to deliver time capsule emails', expect.stringContaining('database down'));
    await worker.onModuleDestroy();
  });
});
