import { Logger } from '@nestjs/common';
import { AccountPurgeWorkerService } from './account-purge-worker.service';

const none = { purgedUserIds: [], failedUserIds: [] };

describe('AccountPurgeWorkerService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('purges expired accounts on start and then every hour until shut down', async () => {
    const purge = { purgeAfterDays: 30, purgeExpired: jest.fn().mockResolvedValue(none) };
    const worker = new AccountPurgeWorkerService(purge as never);

    await worker.start();
    expect(purge.purgeExpired).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(3_600_000);
    expect(purge.purgeExpired).toHaveBeenCalledTimes(2);

    await worker.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(7_200_000);
    expect(purge.purgeExpired).toHaveBeenCalledTimes(2);
  });

  it('never overlaps runs and waits for the current one when shutting down', async () => {
    let finish: () => void = () => undefined;
    const purge = {
      purgeAfterDays: 30,
      purgeExpired: jest.fn(() => new Promise((resolve) => { finish = () => resolve(none); })),
    };
    const worker = new AccountPurgeWorkerService(purge as never);

    const starting = worker.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(purge.purgeExpired).toHaveBeenCalledTimes(1);

    const stopping = worker.onModuleDestroy();
    finish();
    await starting;
    await stopping;
    await jest.advanceTimersByTimeAsync(3_600_000);
    expect(purge.purgeExpired).toHaveBeenCalledTimes(1);
  });

  it('logs counts and user ids of purged and failed accounts only', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const purge = {
      purgeAfterDays: 30,
      purgeExpired: jest.fn()
        .mockResolvedValueOnce({ purgedUserIds: [3, 8], failedUserIds: [5] })
        .mockResolvedValue(none),
    };
    const worker = new AccountPurgeWorkerService(purge as never);

    await worker.start();
    expect(log).toHaveBeenCalledWith('Starting deleted account purge after 30 days');
    expect(log).toHaveBeenCalledWith('Purged 2 deleted accounts: 3, 8');
    expect(warn).toHaveBeenCalledWith('Could not purge 1 deleted accounts: 5');

    log.mockClear();
    await jest.advanceTimersByTimeAsync(3_600_000);
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining('Purged'));
    await worker.onModuleDestroy();
  });

  it('logs a failed run and tries again on the next tick', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const purge = {
      purgeAfterDays: 30,
      purgeExpired: jest.fn().mockRejectedValueOnce(new Error('database down')).mockResolvedValue(none),
    };
    const worker = new AccountPurgeWorkerService(purge as never);

    await worker.start();
    expect(error).toHaveBeenCalledWith('Failed to purge deleted accounts', expect.stringContaining('database down'));

    await jest.advanceTimersByTimeAsync(3_600_000);
    expect(purge.purgeExpired).toHaveBeenCalledTimes(2);
    await worker.onModuleDestroy();
  });
});
