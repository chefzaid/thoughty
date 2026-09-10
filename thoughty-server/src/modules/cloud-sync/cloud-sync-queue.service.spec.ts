import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CloudSyncJob, Setting } from '@/database/entities';
import { CloudSyncQueueService } from './cloud-sync-queue.service';
import { CloudSyncService } from './cloud-sync.service';

describe('CloudSyncQueueService', () => {
  let service: CloudSyncQueueService;
  let jobRepository: any;
  let settingRepository: any;
  let cloudSyncService: any;
  let dataSource: any;
  let queryRunner: any;

  beforeEach(async () => {
    jobRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    settingRepository = {
      find: jest.fn(),
    };

    cloudSyncService = {
      checkSyncDue: jest.fn(),
      executeDiffSync: jest.fn(),
    };

    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([{ id: 1 }]),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    };

    dataSource = {
      query: jest.fn().mockResolvedValue([{ id: 1 }]),
      createQueryRunner: jest.fn(() => queryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudSyncQueueService,
        { provide: getRepositoryToken(CloudSyncJob), useValue: jobRepository },
        { provide: getRepositoryToken(Setting), useValue: settingRepository },
        { provide: DataSource, useValue: dataSource },
        { provide: CloudSyncService, useValue: cloudSyncService },
      ],
    }).compile();

    service = module.get<CloudSyncQueueService>(CloudSyncQueueService);
    jest.spyOn((service as any).logger, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('enqueues due scheduled sync jobs once per provider/user pair', async () => {
    settingRepository.find.mockResolvedValue([
      { userId: 12, key: 'cloud_google_drive_sync_enabled', value: 'true' },
    ]);
    cloudSyncService.checkSyncDue.mockResolvedValue(true);
    dataSource.query.mockResolvedValue([{ id: 99 }]);

    const queuedCount = await service.enqueueDueSyncJobs();

    expect(queuedCount).toBe(1);
    expect(cloudSyncService.checkSyncDue).toHaveBeenCalledWith(12, 'google_drive');
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO cloud_sync_jobs'), [
      12,
      'google_drive',
      3,
    ]);
  });

  it('processes a claimed queued job successfully', async () => {
    queryRunner.query
      .mockResolvedValueOnce([{ id: 7 }])
      .mockResolvedValueOnce([]);
    jobRepository.findOneBy.mockResolvedValue({
      id: 7,
      userId: 4,
      provider: 'google_drive',
      attemptCount: 1,
      maxAttempts: 3,
    });
    cloudSyncService.executeDiffSync.mockResolvedValue({
      synced: true,
      message: 'Sync completed successfully',
    });

    const processedCount = await service.processAvailableJobs('worker-1', 1);

    expect(processedCount).toBe(1);
    expect(cloudSyncService.executeDiffSync).toHaveBeenCalledWith(4, 'google_drive');
    expect(jobRepository.update).toHaveBeenCalledWith(expect.objectContaining({ id: 7, status: 'running', lockedBy: expect.any(String) }), expect.objectContaining({
      status: 'completed',
      resultMessage: 'Sync completed successfully',
    }));
  });

  it('requeues failed jobs while attempts remain', async () => {
    queryRunner.query
      .mockResolvedValueOnce([{ id: 8 }])
      .mockResolvedValueOnce([]);
    jobRepository.findOneBy.mockResolvedValue({
      id: 8,
      userId: 9,
      provider: 'dropbox',
      attemptCount: 1,
      maxAttempts: 3,
      runAt: new Date('2024-01-01T00:00:00Z'),
    });
    cloudSyncService.executeDiffSync.mockRejectedValue(new Error('network timeout'));

    const processedCount = await service.processAvailableJobs('worker-2', 1);

    expect(processedCount).toBe(1);
    expect(jobRepository.update).toHaveBeenCalledWith(expect.objectContaining({ id: 8, status: 'running', lockedBy: expect.any(String) }), expect.objectContaining({
      status: 'queued',
      lastError: 'network timeout',
      lockedAt: null,
      lockedBy: null,
      resultMessage: null,
    }));
  });

  it('recovers stale running jobs for pickup after worker interruption', async () => {
    jobRepository.find.mockResolvedValue([
      {
        id: 11,
        attemptCount: 1,
        maxAttempts: 3,
        lastError: null,
      },
      {
        id: 12,
        attemptCount: 3,
        maxAttempts: 3,
        lastError: 'network timeout',
      },
    ]);

    const recoveredCount = await service.recoverStaleJobs(new Date('2024-06-01T00:00:00Z'));

    expect(recoveredCount).toBe(2);
    expect(jobRepository.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 11, status: 'running' }), expect.objectContaining({
      status: 'queued',
      lockedAt: null,
      lockedBy: null,
    }));
    expect(jobRepository.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 12, status: 'running' }), expect.objectContaining({
      status: 'failed',
      lockedAt: null,
      lockedBy: null,
    }));
  });

  it('does not count a stale read as recovered after another worker renewed it', async () => {
    jobRepository.find.mockResolvedValue([{ id: 11, lockedBy: 'old-claim', attemptCount: 1, maxAttempts: 3 }]);
    jobRepository.update.mockResolvedValue({ affected: 0 });
    expect(await service.recoverStaleJobs()).toBe(0);
    expect(jobRepository.update).toHaveBeenCalledWith(expect.objectContaining({ id: 11, status: 'running', lockedBy: 'old-claim', lockedAt: expect.anything() }), expect.anything());
  });

  it('releases its connection when starting a claim transaction fails', async () => {
    queryRunner.startTransaction.mockRejectedValueOnce(new Error('database disconnected'));
    await expect(service.processAvailableJobs('worker', 1)).rejects.toThrow('database disconnected');
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
    expect(cloudSyncService.executeDiffSync).not.toHaveBeenCalled();
  });

  it('aborts a stalled provider after heartbeat ownership loss without changing the job', async () => {
    jest.useFakeTimers();
    try {
      queryRunner.query.mockResolvedValueOnce([{ id: 7 }]).mockResolvedValueOnce([]);
      jobRepository.findOneBy.mockResolvedValue({ id: 7, userId: 4, provider: 'google_drive', attemptCount: 1, maxAttempts: 3 });
      dataSource.query.mockResolvedValueOnce([{ id: 7 }]).mockResolvedValueOnce([]);
      let finish!: () => void;
      cloudSyncService.executeDiffSync.mockImplementation(() => new Promise(resolve => { finish = () => resolve({ message: 'late upload' }); }));
      const processing = service.processAvailableJobs('worker', 1);
      for (let tick = 0; tick < 20 && !finish; tick++) await Promise.resolve();
      await jest.advanceTimersByTimeAsync(30_000);
      finish();
      await processing;
      expect(jobRepository.update).not.toHaveBeenCalled();
      expect(dataSource.query).toHaveBeenLastCalledWith(expect.stringContaining("locked_at > NOW() - INTERVAL '15 minutes'"), [7, expect.any(String)]);
    } finally { jest.useRealTimers(); }
  });
});
