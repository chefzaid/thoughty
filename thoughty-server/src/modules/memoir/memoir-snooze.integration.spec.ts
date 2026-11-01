import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, Entry, MemoirAnswer, MemoirProgram, MemoirSnooze, User } from '@/database/entities';
import type { DiariesService } from '@/modules/diaries';
import { MemoirDeliveryService } from './memoir-delivery.service';
import { MEMOIR_QUESTIONS } from './memoir-questions';
import { MemoirService } from './memoir.service';

const ids = MEMOIR_QUESTIONS.map((question) => question.id);

describePostgres('PostgreSQL memoir "Not this week"', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let service: MemoirService;
  let delivery: MemoirDeliveryService;
  let writerId: number;
  let diaryId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    const emailService = { isConfigured: () => false };
    service = new MemoirService(
      dataSource.getRepository(MemoirProgram),
      dataSource.getRepository(MemoirAnswer),
      dataSource.getRepository(MemoirSnooze),
      dataSource.getRepository(Diary),
      dataSource.getRepository(User),
      {} as DiariesService,
      emailService as never,
    );
    delivery = new MemoirDeliveryService(
      dataSource,
      dataSource.getRepository(MemoirProgram),
      { getConfig: async () => ({ language: 'en' }) } as never,
      emailService as never,
      { get: (_key: string, fallback?: string) => fallback } as never,
    );
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => {
    await database?.drop();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    writerId = (await dataSource.getRepository(User).save({ username: 'writer', email: 'writer@example.com' })).id;
    diaryId = (await dataSource.getRepository(Diary).save({ userId: writerId, name: 'Memoir', position: 0 })).id;
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  /** Runs `work` while the services read `at` as now; PostgreSQL and its timers keep real time. */
  async function at<T>(instant: string, work: () => Promise<T>): Promise<T> {
    jest.useFakeTimers({ now: new Date(instant), doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame',
      'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval',
      'clearInterval', 'setTimeout', 'clearTimeout'] });
    try {
      return await work();
    } finally {
      jest.useRealTimers();
    }
  }

  const startMondays = (timeZone: string, nextDeliveryAt: string) =>
    dataSource.getRepository(MemoirProgram).save({
      userId: writerId,
      diaryId,
      deliveryWeekday: 1,
      timeZone,
      currentQuestionId: ids[0],
      nextDeliveryAt: new Date(nextDeliveryAt),
    });

  const currentQuestion = async () =>
    (await dataSource.getRepository(MemoirProgram).findOneByOrFail({ userId: writerId })).currentQuestionId;

  it('brings the question back in Kiritimati with the fourth Monday, while UTC is still on Sunday', async () => {
    // Sunday 1 November 19:30 UTC is Monday 2 November 09:30 in Kiritimati: this Monday's question is out
    const program = await startMondays('Pacific/Kiritimati', '2026-11-08T19:00:00Z');
    const overview = await at('2026-11-01T19:30:00Z', () => service.snooze(writerId));

    expect(overview.program?.currentQuestionId).toBe(ids[1]);
    expect(overview.chapters[0].questions[0].snoozedUntil).toBe('2026-11-30');
    const [stored] = await dataSource.getRepository(MemoirSnooze).findBy({ programId: program.id });
    expect(stored).toEqual(expect.objectContaining({ questionId: ids[0], snoozedUntil: '2026-11-30' }));

    // Each Monday 09:00 in Kiritimati is Sunday 19:00 UTC
    const delivered: Array<string | null> = [];
    for (const sunday of ['2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29']) {
      await delivery.deliverDueQuestions(new Date(`${sunday}T19:00:30Z`));
      delivered.push(await currentQuestion());
    }
    expect(delivered).toEqual([ids[2], ids[3], ids[4], ids[0]]);
    await expect(dataSource.getRepository(MemoirSnooze).count()).resolves.toBe(0);
  });

  it('shows an empty week in Pago Pago while every remaining question is set aside, until the first comes back', async () => {
    const program = await startMondays('Pacific/Pago_Pago', '2026-11-02T20:00:00Z');
    // Every question but the first two is answered
    for (const questionId of ids.slice(2)) {
      const entry = await dataSource.getRepository(Entry).save({ userId: writerId, diaryId, date: '2026-10-01', content: questionId });
      await dataSource.getRepository(MemoirAnswer).insert({ userId: writerId, questionId, entryId: entry.id });
    }

    // Monday 2 November 08:30 in Pago Pago (19:30 UTC): today's 09:00 delivery is still ahead
    await at('2026-11-02T19:30:00Z', () => service.snooze(writerId));
    const empty = await at('2026-11-02T19:31:00Z', () => service.snooze(writerId));
    expect(empty.program?.currentQuestionId).toBeNull();
    expect(empty.chapters[0].questions.slice(0, 2).map((question) => question.snoozedUntil)).toEqual(['2026-11-23', '2026-11-23']);

    for (const monday of ['2026-11-02', '2026-11-09', '2026-11-16']) {
      await delivery.deliverDueQuestions(new Date(`${monday}T20:00:30Z`));
      await expect(currentQuestion()).resolves.toBeNull();
    }
    // Monday 23 November 09:00 in Pago Pago: both are back, the first in life order goes first
    await delivery.deliverDueQuestions(new Date('2026-11-23T20:00:30Z'));
    await expect(currentQuestion()).resolves.toBe(ids[0]);
    const kept = await dataSource.getRepository(MemoirSnooze).findBy({ programId: program.id });
    expect(kept.map((snooze) => snooze.questionId)).toEqual([ids[1]]);
    const overview = await at('2026-11-23T20:01:00Z', () => service.getOverview(writerId));
    expect(overview.chapters[0].questions[1].snoozedUntil).toBeNull();

    // Stopping the memoir clears what was set aside with it
    await service.leave(writerId);
    await expect(dataSource.getRepository(MemoirSnooze).count()).resolves.toBe(0);
  });
});
