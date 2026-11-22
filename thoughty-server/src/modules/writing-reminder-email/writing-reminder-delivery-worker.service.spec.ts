import { Logger } from '@nestjs/common';
import { WritingReminderDeliveryWorkerService } from './writing-reminder-delivery-worker.service';

describe('WritingReminderDeliveryWorkerService', () => {
  beforeEach(() => jest.useFakeTimers());

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('delivers on start and every minute, naming the writing reminder in its logs', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const delivery = { deliverDue: jest.fn().mockResolvedValueOnce(2).mockRejectedValueOnce(new Error('database down')) };
    const worker = new WritingReminderDeliveryWorkerService(delivery as never);

    await worker.start();
    expect(log).toHaveBeenCalledWith('Starting writing reminder email delivery');
    expect(log).toHaveBeenCalledWith('Sent 2 writing reminder emails');

    await jest.advanceTimersByTimeAsync(60_000);
    expect(error).toHaveBeenCalledWith('Failed to deliver writing reminder emails', expect.stringContaining('database down'));
    await worker.onModuleDestroy();
  });
});
