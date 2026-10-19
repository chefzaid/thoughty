import { Logger } from '@nestjs/common';
import { MemoirDeliveryWorkerService } from './memoir-delivery-worker.service';

describe('MemoirDeliveryWorkerService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('delivers on start and then every minute until shut down', async () => {
    const delivery = { deliverDueQuestions: jest.fn().mockResolvedValue(0) };
    const worker = new MemoirDeliveryWorkerService(delivery as never);

    await worker.start();
    expect(delivery.deliverDueQuestions).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(60_000);
    expect(delivery.deliverDueQuestions).toHaveBeenCalledTimes(2);

    await worker.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(120_000);
    expect(delivery.deliverDueQuestions).toHaveBeenCalledTimes(2);
  });

  it('never overlaps runs and waits for the current one when shutting down', async () => {
    let finish: () => void = () => undefined;
    const delivery = {
      deliverDueQuestions: jest.fn(() => new Promise<number>((resolve) => { finish = () => resolve(1); })),
    };
    const worker = new MemoirDeliveryWorkerService(delivery as never);

    const starting = worker.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(delivery.deliverDueQuestions).toHaveBeenCalledTimes(1);

    const stopping = worker.onModuleDestroy();
    finish();
    await starting;
    await stopping;
    await jest.advanceTimersByTimeAsync(60_000);
    expect(delivery.deliverDueQuestions).toHaveBeenCalledTimes(1);
  });

  it('logs a failed run and tries again on the next tick', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const delivery = {
      deliverDueQuestions: jest.fn().mockRejectedValueOnce(new Error('database down')).mockResolvedValue(0),
    };
    const worker = new MemoirDeliveryWorkerService(delivery as never);

    await worker.start();
    expect(error).toHaveBeenCalledWith('Failed to deliver weekly memoir questions', expect.stringContaining('database down'));

    await jest.advanceTimersByTimeAsync(60_000);
    expect(delivery.deliverDueQuestions).toHaveBeenCalledTimes(2);
    await worker.onModuleDestroy();
  });
});
