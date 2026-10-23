import { Logger } from '@nestjs/common';
import { RecycleBinPurgeWorkerService } from './recycle-bin-purge-worker.service';

describe('RecycleBinPurgeWorkerService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('empties expired entries on start and then every hour until shut down', async () => {
    const bin = { purgeExpired: jest.fn().mockResolvedValue(0) };
    const worker = new RecycleBinPurgeWorkerService(bin as never);

    await worker.start();
    expect(bin.purgeExpired).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(3_600_000);
    expect(bin.purgeExpired).toHaveBeenCalledTimes(2);

    await worker.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(7_200_000);
    expect(bin.purgeExpired).toHaveBeenCalledTimes(2);
  });

  it('never overlaps runs and waits for the current one when shutting down', async () => {
    let finish: () => void = () => undefined;
    const bin = {
      purgeExpired: jest.fn(() => new Promise<number>((resolve) => { finish = () => resolve(1); })),
    };
    const worker = new RecycleBinPurgeWorkerService(bin as never);

    const starting = worker.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(bin.purgeExpired).toHaveBeenCalledTimes(1);

    const stopping = worker.onModuleDestroy();
    finish();
    await starting;
    await stopping;
    await jest.advanceTimersByTimeAsync(3_600_000);
    expect(bin.purgeExpired).toHaveBeenCalledTimes(1);
  });

  it('logs how many entries a run removed', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const bin = { purgeExpired: jest.fn().mockResolvedValueOnce(4).mockResolvedValue(0) };
    const worker = new RecycleBinPurgeWorkerService(bin as never);

    await worker.start();
    expect(log).toHaveBeenCalledWith('Removed 4 expired entries from recycle bins');

    log.mockClear();
    await jest.advanceTimersByTimeAsync(3_600_000);
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining('Removed'));
    await worker.onModuleDestroy();
  });

  it('logs a failed run and tries again on the next tick', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const bin = {
      purgeExpired: jest.fn().mockRejectedValueOnce(new Error('database down')).mockResolvedValue(0),
    };
    const worker = new RecycleBinPurgeWorkerService(bin as never);

    await worker.start();
    expect(error).toHaveBeenCalledWith('Failed to empty expired recycle bin entries', expect.stringContaining('database down'));

    await jest.advanceTimersByTimeAsync(3_600_000);
    expect(bin.purgeExpired).toHaveBeenCalledTimes(2);
    await worker.onModuleDestroy();
  });
});
