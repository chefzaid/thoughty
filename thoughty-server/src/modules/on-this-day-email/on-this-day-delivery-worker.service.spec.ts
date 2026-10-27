import { Logger } from '@nestjs/common';
import { OnThisDayDeliveryWorkerService } from './on-this-day-delivery-worker.service';

describe('OnThisDayDeliveryWorkerService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('delivers on start and then every minute until shut down, counting what went out', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const delivery = { deliverDue: jest.fn().mockResolvedValueOnce(0).mockResolvedValue(2) };
    const worker = new OnThisDayDeliveryWorkerService(delivery as never);

    await worker.start();
    expect(delivery.deliverDue).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining('Sent'));

    await jest.advanceTimersByTimeAsync(60_000);
    expect(delivery.deliverDue).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith('Sent 2 On this day emails');

    await worker.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(120_000);
    expect(delivery.deliverDue).toHaveBeenCalledTimes(2);
  });

  it('never overlaps runs and waits for the current one when shutting down', async () => {
    let finish: () => void = () => undefined;
    const delivery = { deliverDue: jest.fn(() => new Promise<number>((resolve) => { finish = () => resolve(0); })) };
    const worker = new OnThisDayDeliveryWorkerService(delivery as never);

    const starting = worker.start();
    await jest.advanceTimersByTimeAsync(0);
    const stopping = worker.onModuleDestroy();
    finish();
    await starting;
    await stopping;
    await jest.advanceTimersByTimeAsync(60_000);
    expect(delivery.deliverDue).toHaveBeenCalledTimes(1);
  });

  it('logs a failed run and tries again on the next tick', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const delivery = { deliverDue: jest.fn().mockRejectedValueOnce(new Error('database down')).mockResolvedValue(0) };
    const worker = new OnThisDayDeliveryWorkerService(delivery as never);

    await worker.start();
    expect(error).toHaveBeenCalledWith('Failed to deliver On this day emails', expect.stringContaining('database down'));

    await jest.advanceTimersByTimeAsync(60_000);
    expect(delivery.deliverDue).toHaveBeenCalledTimes(2);
    await worker.onModuleDestroy();
  });
});
