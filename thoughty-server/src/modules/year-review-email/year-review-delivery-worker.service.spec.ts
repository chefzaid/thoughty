import { Logger } from '@nestjs/common';
import { YearReviewDeliveryWorkerService } from './year-review-delivery-worker.service';

describe('YearReviewDeliveryWorkerService', () => {
  beforeEach(() => jest.useFakeTimers());

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('delivers on start and every minute, naming the year in review in its logs', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const delivery = { deliverDue: jest.fn().mockResolvedValueOnce(2).mockRejectedValueOnce(new Error('database down')) };
    const worker = new YearReviewDeliveryWorkerService(delivery as never);

    await worker.start();
    expect(log).toHaveBeenCalledWith('Starting year in review email delivery');
    expect(log).toHaveBeenCalledWith('Sent 2 year in review emails');

    await jest.advanceTimersByTimeAsync(60_000);
    expect(error).toHaveBeenCalledWith('Failed to deliver year in review emails', expect.stringContaining('database down'));
    await worker.onModuleDestroy();
  });
});
