import { Logger } from '@nestjs/common';
import { MonthlyRecapDeliveryWorkerService } from './monthly-recap-delivery-worker.service';

describe('MonthlyRecapDeliveryWorkerService', () => {
  beforeEach(() => jest.useFakeTimers());

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('delivers on start and every minute, naming the monthly recap in its logs', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const delivery = { deliverDue: jest.fn().mockResolvedValueOnce(1).mockRejectedValueOnce(new Error('database down')) };
    const worker = new MonthlyRecapDeliveryWorkerService(delivery as never);

    await worker.start();
    expect(log).toHaveBeenCalledWith('Starting monthly recap email delivery');
    expect(log).toHaveBeenCalledWith('Sent 1 monthly recap emails');

    await jest.advanceTimersByTimeAsync(60_000);
    expect(error).toHaveBeenCalledWith('Failed to deliver monthly recap emails', expect.stringContaining('database down'));
    await worker.onModuleDestroy();
  });
});
