import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { CloudSyncJob, Diary, Entry, Setting, User } from '@/database/entities';
import { EntryMentionsService } from '@/modules/entries';
import { IoService } from '@/modules/io/io.service';
import { timeCapsuleServiceOn } from '@/modules/time-capsules/time-capsules.test-helpers';
import { CloudSyncQueueService } from './cloud-sync-queue.service';
import { CloudSyncService } from './cloud-sync.service';

// 10:30 UTC on 31 October 2026: already 00:30 on 1 November in Kiritimati (UTC+14), still 23:30 on
// 30 October in Pago Pago (UTC-11).
const NOW = new Date('2026-10-31T10:30:00.000Z');

/**
 * The worker's scheduled syncs, from the schedule the writer saves to the file the provider receives,
 * name the file after the day in the time zone saved with the schedule.
 */
describePostgres('PostgreSQL scheduled cloud sync on the writer’s day', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let cloudSync: CloudSyncService;
  let queue: CloudSyncQueueService;
  const uploadFile = jest.fn(async (_token: string, name: string) => ({ id: name, name, size: 1, modifiedAt: NOW.toISOString() }));

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    const entries = dataSource.getRepository(Entry);
    const settings = dataSource.getRepository(Setting);
    const io = new IoService(entries, settings, dataSource.getRepository(Diary), dataSource.getRepository(User),
      new EntryMentionsService(entries), timeCapsuleServiceOn(dataSource), { getFileBuffer: jest.fn() } as never);
    const googleDrive = {
      isConfigured: () => true,
      exchangeCode: async () => ({ accessToken: 'access', refreshToken: 'refresh', expiresAt: Date.now() + 3_600_000 }),
      uploadFile,
    };
    cloudSync = new CloudSyncService(settings, io, googleDrive as never, {} as never, {} as never);
    queue = new CloudSyncQueueService(dataSource.getRepository(CloudSyncJob), settings, dataSource, cloudSync);
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    // Only the clock the service reads is the writer's moment; PostgreSQL and the worker's timers keep real time
    jest.useFakeTimers({ now: NOW, doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame',
      'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval',
      'clearInterval', 'setTimeout', 'clearTimeout'] });
    await dataSource.query('TRUNCATE users, cloud_sync_jobs RESTART IDENTITY CASCADE');
    uploadFile.mockClear();
  });
  afterEach(() => { jest.useRealTimers(); });

  async function writerWithDailySync(timeZone: string): Promise<number> {
    const writer = await dataSource.getRepository(User).save({ username: 'writer', email: 'writer@example.com' });
    const diary = await dataSource.getRepository(Diary).save({ userId: writer.id, name: 'Journal', isDefault: true, position: 0 });
    await dataSource.getRepository(Entry).save({ userId: writer.id, diaryId: diary.id, date: '2026-10-30', content: 'A quiet evening' });
    await cloudSync.connect(writer.id, 'google_drive', 'code', 'https://thoughty.example/cloud');
    await expect(cloudSync.setSyncSchedule(writer.id, 'google_drive', 'daily', timeZone)).resolves.toEqual({ success: true });
    return writer.id;
  }

  async function runWorker(): Promise<string[]> {
    expect(await queue.enqueueDueSyncJobs()).toBe(1);
    expect(await queue.processAvailableJobs('worker', 1)).toBe(1);
    const [job] = await dataSource.getRepository(CloudSyncJob).find();
    expect(job).toMatchObject({ status: 'completed', resultMessage: 'Sync completed successfully' });
    return uploadFile.mock.calls.map(([, name]) => name);
  }

  it.each([
    ['Pacific/Kiritimati', '2026-11-01'],
    ['Pacific/Pago_Pago', '2026-10-30'],
  ])('names the file after the day in %s', async (timeZone, day) => {
    const writerId = await writerWithDailySync(timeZone);

    await expect(runWorker()).resolves.toEqual([`thoughty_all_diaries_${day}.txt`]);
    expect((await cloudSync.getSyncSchedules(writerId)).google_drive.timeZone).toBe(timeZone);
  });

  it('names a schedule saved without a time zone after the UTC day', async () => {
    const writerId = await writerWithDailySync('Pacific/Kiritimati');
    // As a schedule saved before the time zone was: the row is absent
    await dataSource.getRepository(Setting).delete({ userId: writerId, key: 'cloud_google_drive_sync_time_zone' });

    await expect(runWorker()).resolves.toEqual(['thoughty_all_diaries_2026-10-31.txt']);
    expect((await cloudSync.getSyncSchedules(writerId)).google_drive.timeZone).toBeUndefined();
  });

  it('forgets the time zone with the schedule', async () => {
    const writerId = await writerWithDailySync('Pacific/Pago_Pago');

    await cloudSync.deleteSyncSchedule(writerId, 'google_drive');

    expect(await dataSource.getRepository(Setting).countBy({ userId: writerId, key: 'cloud_google_drive_sync_time_zone' })).toBe(0);
  });
});
