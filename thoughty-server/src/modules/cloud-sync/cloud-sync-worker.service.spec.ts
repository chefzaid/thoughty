import { CloudSyncWorkerService } from './cloud-sync-worker.service';

describe('CloudSyncWorkerService', () => {
  let service: CloudSyncWorkerService;
  let cloudSyncQueueService: {
    enqueueDueSyncJobs: jest.Mock;
    processAvailableJobs: jest.Mock;
    recoverStaleJobs: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    cloudSyncQueueService = {
      enqueueDueSyncJobs: jest.fn().mockResolvedValue(undefined),
      processAvailableJobs: jest.fn().mockResolvedValue(undefined),
      recoverStaleJobs: jest.fn().mockResolvedValue(undefined),
    };

    service = new CloudSyncWorkerService(cloudSyncQueueService as never);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('starts immediately, logs startup, and schedules recurring work', async () => {
    const logger = {
      error: jest.fn(),
      log: jest.fn(),
    };
    Object.defineProperty(service as object, 'logger', {
      value: logger,
      configurable: true,
    });

    await service.start();

    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Starting cloud sync worker'));
    expect(cloudSyncQueueService.enqueueDueSyncJobs).toHaveBeenCalledTimes(1);
    expect(cloudSyncQueueService.recoverStaleJobs).toHaveBeenCalledTimes(1);
    expect(cloudSyncQueueService.processAvailableJobs).toHaveBeenCalledWith(expect.any(String), 5);

    jest.advanceTimersByTime(60_000);
    await Promise.resolve();

    expect(cloudSyncQueueService.enqueueDueSyncJobs).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(5_000);
    await Promise.resolve();

    expect(cloudSyncQueueService.recoverStaleJobs).toHaveBeenCalledTimes(2);
    expect(cloudSyncQueueService.processAvailableJobs).toHaveBeenCalledTimes(2);
  });

  it('clears both timers on module destroy', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    await service.start();
    service.onModuleDestroy();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
  });

  it('skips schedule scanning when a scan is already in progress', async () => {
    (service as any).scanningSchedules = true;

    await (service as any).scanSchedules();

    expect(cloudSyncQueueService.enqueueDueSyncJobs).not.toHaveBeenCalled();
  });

  it('logs schedule scan failures and clears the in-progress flag', async () => {
    const logger = {
      error: jest.fn(),
      log: jest.fn(),
    };
    const error = new Error('scan failed');
    Object.defineProperty(service as object, 'logger', {
      value: logger,
      configurable: true,
    });
    cloudSyncQueueService.enqueueDueSyncJobs.mockRejectedValue(error);

    await (service as any).scanSchedules();

    expect(logger.error).toHaveBeenCalledWith('Failed to enqueue due cloud sync jobs', error.stack);
    expect((service as any).scanningSchedules).toBe(false);
  });

  it('skips job processing when processing is already in progress', async () => {
    (service as any).processingJobs = true;

    await (service as any).processJobs();

    expect(cloudSyncQueueService.recoverStaleJobs).not.toHaveBeenCalled();
    expect(cloudSyncQueueService.processAvailableJobs).not.toHaveBeenCalled();
  });

  it('logs job processing failures and clears the in-progress flag', async () => {
    const logger = {
      error: jest.fn(),
      log: jest.fn(),
    };
    const error = new Error('process failed');
    Object.defineProperty(service as object, 'logger', {
      value: logger,
      configurable: true,
    });
    cloudSyncQueueService.recoverStaleJobs.mockRejectedValue(error);

    await (service as any).processJobs();

    expect(logger.error).toHaveBeenCalledWith('Failed to process queued cloud sync jobs', error.stack);
    expect((service as any).processingJobs).toBe(false);
  });
});