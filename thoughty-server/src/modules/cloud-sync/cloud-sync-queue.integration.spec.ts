import { DataSource } from 'typeorm';
import { CloudSyncJob } from '@/database/entities';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { CloudSyncQueueService } from './cloud-sync-queue.service';

function pending() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describePostgres('PostgreSQL cloud sync lease races', () => {
  let database: PostgresTestDatabase;
  let first: DataSource;
  let second: DataSource;
  beforeAll(async () => {
    database = await createPostgresTestDatabase({ entities: [CloudSyncJob], synchronize: true });
    first = database.dataSource;
    second = await new DataSource({ type: 'postgres', url: database.url, entities: [CloudSyncJob] }).initialize();
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await second?.destroy(); await database?.drop(); });
  beforeEach(async () => { await first.query('TRUNCATE cloud_sync_jobs RESTART IDENTITY'); });

  function queue(database: DataSource, executeDiffSync = jest.fn().mockResolvedValue({ message: 'done' })) {
    return new CloudSyncQueueService(database.getRepository(CloudSyncJob), {} as never, database,
      { executeDiffSync } as never);
  }
  const createJob = () => first.getRepository(CloudSyncJob).save({ userId: 1, provider: 'google_drive',
    status: 'queued', triggerType: 'scheduled', attemptCount: 0, maxAttempts: 3, runAt: new Date() });

  it.each(['completed', 'failed'])('a stale %s owner cannot overwrite a replacement claim', async outcome => {
    const row = await createJob();
    const oldStarted = pending();
    const newStarted = pending();
    const oldWork = pending();
    const newWork = pending();
    const older = queue(first, jest.fn(async () => { oldStarted.resolve(); await oldWork.promise; return { message: 'old' }; }));
    const replacement = queue(second, jest.fn(async () => { newStarted.resolve(); await newWork.promise; return { message: 'new' }; }));
    const oldRun = older.processAvailableJobs('same-worker-name', 1);
    await oldStarted.promise;
    expect(await replacement.processAvailableJobs('same-worker-name', 1)).toBe(0);
    const originalToken = (await first.getRepository(CloudSyncJob).findOneByOrFail({ id: row.id })).lockedBy;
    await first.query("UPDATE cloud_sync_jobs SET locked_at = NOW() - INTERVAL '16 minutes' WHERE id = $1", [row.id]);
    expect(await replacement.recoverStaleJobs()).toBe(1);
    const newRun = replacement.processAvailableJobs('same-worker-name', 1);
    await newStarted.promise;
    const replacementToken = (await first.getRepository(CloudSyncJob).findOneByOrFail({ id: row.id })).lockedBy;
    expect(replacementToken).not.toBe(originalToken);
    if (outcome === 'failed') oldWork.reject(new Error('old network failure'));
    else oldWork.resolve();
    await oldRun;
    const stillOwned = await first.getRepository(CloudSyncJob).findOneByOrFail({ id: row.id });
    expect(stillOwned.status).toBe('running');
    expect(stillOwned.lockedBy).toBe(replacementToken);
    newWork.resolve();
    await newRun;
    expect((await first.getRepository(CloudSyncJob).findOneByOrFail({ id: row.id })).resultMessage).toBe('new');
    older.stop(); replacement.stop();
  });

  it('a heartbeat between stale selection and recovery prevents requeue', async () => {
    const row = await createJob();
    await first.query("UPDATE cloud_sync_jobs SET status = 'running', locked_by = 'owner', locked_at = NOW() - INTERVAL '16 minutes' WHERE id = $1", [row.id]);
    const repository = first.getRepository(CloudSyncJob);
    const find = repository.find.bind(repository);
    jest.spyOn(repository, 'find').mockImplementationOnce(async options => {
      const stale = await find(options);
      await second.query('UPDATE cloud_sync_jobs SET locked_at = NOW() WHERE id = $1', [row.id]);
      return stale;
    });
    const service = new CloudSyncQueueService(repository, {} as never, first, {} as never);
    expect(await service.recoverStaleJobs()).toBe(0);
    expect((await repository.findOneByOrFail({ id: row.id })).status).toBe('running');
  });
});
