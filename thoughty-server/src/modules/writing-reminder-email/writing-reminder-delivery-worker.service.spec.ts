import { Logger } from '@nestjs/common';
import { WritingReminderDeliveryWorkerService } from './writing-reminder-delivery-worker.service';

describe('WritingReminderDeliveryWorkerService', () => {
  beforeEach(() => jest.useFakeTimers());

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('delivers the account’s and the diaries’ reminders on start and every minute, naming the writing reminder in its logs', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const delivery = { deliverDue: jest.fn().mockResolvedValueOnce(2).mockRejectedValueOnce(new Error('database down')) };
    const diaryDelivery = { deliverDue: jest.fn().mockResolvedValue(1) };
    const worker = new WritingReminderDeliveryWorkerService(delivery as never, diaryDelivery as never);

    await worker.start();
    expect(log).toHaveBeenCalledWith('Starting writing reminder email delivery');
    // The account's reminders and the diaries' own ones, counted together
    expect(log).toHaveBeenCalledWith('Sent 3 writing reminder emails');

    await jest.advanceTimersByTimeAsync(60_000);
    expect(error).toHaveBeenCalledWith('Failed to deliver writing reminder emails', expect.stringContaining('database down'));
    await worker.onModuleDestroy();
  });
});
