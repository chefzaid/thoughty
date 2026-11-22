import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, DiaryWritingReminder, Entry, MonthlyRecapEmail, OnThisDayEmail, Setting, User, WritingReminderEmail } from '@/database/entities';
import type { RenderedEmail } from '@/modules/auth/services/email.service';
import { ConfigService } from '@/modules/config';
import { createEmailUnsubscribeToken } from '@/modules/opt-in-email/email-unsubscribe-token';
import { EmailUnsubscribeService } from '@/modules/opt-in-email/email-unsubscribe.service';
import { StatsStreakService } from '@/modules/stats/stats-streak.service';
import { DiaryWritingReminderDeliveryService } from './diary-writing-reminder-delivery.service';
import { DiaryWritingReminderService } from './diary-writing-reminder.service';
import { WritingReminderDeliveryService } from './writing-reminder-delivery.service';
import { WritingReminderEmailService } from './writing-reminder-email.service';

const SECRET = 'd'.repeat(48);
// 06:00 UTC on 23 November 2026 is 07:00 in Paris, on winter time.
const MORNING_IN_PARIS = new Date('2026-11-23T06:00:00Z');

describePostgres('PostgreSQL diary writing reminders', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let diaryReminders: DiaryWritingReminderService;
  let accountReminder: WritingReminderEmailService;
  let diaryDelivery: DiaryWritingReminderDeliveryService;
  let accountDelivery: WritingReminderDeliveryService;
  let unsubscribe: EmailUnsubscribeService;
  let sent: RenderedEmail[];
  let writerId: number;
  let home: Diary;
  let work: Diary;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    const emailService = {
      isConfigured: () => true,
      sendRenderedEmail: async (_to: string, email: RenderedEmail) => {
        sent.push(email);
      },
    };
    const nestConfig = { get: (key: string, fallback?: string) => ({ UNSUBSCRIBE_SECRET: SECRET, FRONTEND_URL: 'https://thoughty.example.com' })[key] ?? fallback };
    const streaks = new StatsStreakService(dataSource.getRepository(Entry));
    const config = new ConfigService(dataSource.getRepository(Setting));
    diaryReminders = new DiaryWritingReminderService(
      dataSource.getRepository(DiaryWritingReminder),
      dataSource.getRepository(WritingReminderEmail),
      dataSource.getRepository(Diary),
      dataSource.getRepository(User),
      emailService as never,
    );
    accountReminder = new WritingReminderEmailService(
      dataSource.getRepository(WritingReminderEmail),
      dataSource.getRepository(Diary),
      dataSource.getRepository(User),
      emailService as never,
      diaryReminders,
    );
    diaryDelivery = new DiaryWritingReminderDeliveryService(dataSource, streaks, config, emailService as never, nestConfig as never);
    accountDelivery = new WritingReminderDeliveryService(
      dataSource,
      streaks,
      config,
      emailService as never,
      nestConfig as never,
      dataSource.getRepository(DiaryWritingReminder),
    );
    unsubscribe = new EmailUnsubscribeService(
      dataSource.getRepository(OnThisDayEmail),
      dataSource.getRepository(MonthlyRecapEmail),
      dataSource.getRepository(WritingReminderEmail),
      nestConfig as never,
      dataSource.getRepository(DiaryWritingReminder),
    );
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    sent = [];
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    writerId = (await dataSource.getRepository(User).save({ username: 'writer', email: 'writer@example.com', emailVerified: true })).id;
    home = await dataSource.getRepository(Diary).save({ userId: writerId, name: 'Home', position: 0 });
    work = await dataSource.getRepository(Diary).save({ userId: writerId, name: 'Work', position: 1 });
  });

  /** Runs `work` with the clock at `at`, as a save from Manage Diaries or Profile then would. */
  const at = async <T>(when: string, work: () => Promise<T>): Promise<T> => {
    jest.useFakeTimers({ now: new Date(when), doNotFake: ['nextTick', 'setImmediate'] });
    try {
      return await work();
    } finally {
      jest.useRealTimers();
    }
  };
  const write = (date: string, diaryId: number) =>
    dataSource.getRepository(Entry).save({ userId: writerId, diaryId, date, index: 1, tags: [], content: 'A few lines', visibility: 'private' });

  it('reminds a diary at its own hour on a day without an entry in it, once, whether or not the Profile reminder is on', async () => {
    await write('2026-11-23', home.id);
    const saved = await at('2026-11-22T20:00:00Z', () => diaryReminders.update(writerId, work.id, { deliveryHour: 7, timeZone: 'Europe/Paris' }));
    expect(saved.reminders).toEqual([{ diaryId: work.id, deliveryHour: 7, timeZone: 'Europe/Paris', nextSendAt: '2026-11-23T06:00:00.000Z' }]);

    await expect(diaryDelivery.deliverDue(MORNING_IN_PARIS)).resolves.toBe(1);
    expect(sent[0].text).toContain(`https://thoughty.example.com/journal?diary=${work.id}`);
    expect(sent[0].text).toContain('for this diary in Manage Diaries');

    // Moving the hour later the same day does not remind again.
    await at('2026-11-23T06:30:00Z', () => diaryReminders.update(writerId, work.id, { deliveryHour: 8, timeZone: 'Europe/Paris' }));
    await expect(diaryDelivery.deliverDue(new Date('2026-11-23T07:00:00Z'))).resolves.toBe(0);

    await write('2026-11-24', work.id);
    await expect(diaryDelivery.deliverDue(new Date('2026-11-24T07:00:00Z'))).resolves.toBe(0);
    expect(sent).toHaveLength(1);
  });

  it('overrides the Profile reminder for its diary only, and follows the Profile reminder’s time zone', async () => {
    await at('2026-11-22T10:00:00Z', () => accountReminder.update(writerId, { enabled: true, deliveryHour: 20, timeZone: 'Europe/Paris', diaryId: work.id }));
    await at('2026-11-22T10:00:00Z', () => diaryReminders.update(writerId, work.id, { deliveryHour: 7, timeZone: 'America/New_York' }));
    expect((await diaryReminders.list(writerId)).reminders[0].timeZone).toBe('Europe/Paris');

    await expect(accountDelivery.deliverDue(new Date('2026-11-22T19:00:00Z'))).resolves.toBe(0);
    await at('2026-11-22T10:00:00Z', () => diaryReminders.update(writerId, work.id, { deliveryHour: null, timeZone: 'Europe/Paris' }));
    await expect(accountDelivery.deliverDue(new Date('2026-11-23T19:00:00Z'))).resolves.toBe(1);

    await at('2026-11-23T20:00:00Z', () => diaryReminders.update(writerId, home.id, { deliveryHour: 7, timeZone: 'Europe/Paris' }));
    await at('2026-11-23T20:00:00Z', () => accountReminder.update(writerId, { enabled: true, deliveryHour: 20, timeZone: 'Asia/Tokyo', diaryId: null }));
    // 20:00 UTC on the 23rd is already 05:00 on the 24th in Tokyo, so 07:00 there is still ahead that day.
    expect((await diaryReminders.list(writerId)).reminders).toEqual([
      { diaryId: home.id, deliveryHour: 7, timeZone: 'Asia/Tokyo', nextSendAt: '2026-11-23T22:00:00.000Z' },
    ]);
  });

  it('stops with the writing reminder’s unsubscribe link, goes with its diary, and is in no other writer’s list', async () => {
    await diaryReminders.update(writerId, home.id, { deliveryHour: 7, timeZone: 'Europe/Paris' });
    await diaryReminders.update(writerId, work.id, { deliveryHour: 9, timeZone: 'Europe/Paris' });
    const otherId = (await dataSource.getRepository(User).save({ username: 'other', email: 'other@example.com', emailVerified: true })).id;
    expect((await diaryReminders.list(otherId)).reminders).toEqual([]);

    await dataSource.getRepository(Diary).delete(work.id);
    expect((await diaryReminders.list(writerId)).reminders.map((reminder) => reminder.diaryId)).toEqual([home.id]);

    await unsubscribe.unsubscribe(createEmailUnsubscribeToken('writing-reminder', writerId, SECRET));
    expect((await diaryReminders.list(writerId)).reminders).toEqual([]);
    await expect(diaryDelivery.deliverDue(new Date('2026-11-30T06:00:00Z'))).resolves.toBe(0);
  });
});
