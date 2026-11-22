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
import { DiaryWritingReminderService } from './diary-writing-reminder.service';
import { WritingReminderDeliveryService } from './writing-reminder-delivery.service';
import { WritingReminderEmailService } from './writing-reminder-email.service';

const SECRET = 'w'.repeat(48);
// 19:00 UTC on 22 November 2026 is 20:00 in Paris, the default hour, on winter time.
const EVENING_IN_PARIS = new Date('2026-11-22T19:00:00Z');

describePostgres('PostgreSQL writing reminder email', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let settings: WritingReminderEmailService;
  let delivery: WritingReminderDeliveryService;
  let unsubscribe: EmailUnsubscribeService;
  let sent: Array<{ to: string; email: RenderedEmail }>;
  let writerId: number;
  let home: Diary;
  let work: Diary;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    const emailService = {
      isConfigured: () => true,
      sendRenderedEmail: async (to: string, email: RenderedEmail) => {
        sent.push({ to, email });
      },
    };
    const nestConfig = { get: (key: string, fallback?: string) => ({ UNSUBSCRIBE_SECRET: SECRET, FRONTEND_URL: 'https://thoughty.example.com' })[key] ?? fallback };
    settings = new WritingReminderEmailService(
      dataSource.getRepository(WritingReminderEmail),
      dataSource.getRepository(Diary),
      dataSource.getRepository(User),
      emailService as never,
      new DiaryWritingReminderService(
        dataSource.getRepository(DiaryWritingReminder),
        dataSource.getRepository(WritingReminderEmail),
        dataSource.getRepository(Diary),
        dataSource.getRepository(User),
        emailService as never,
      ),
    );
    delivery = new WritingReminderDeliveryService(
      dataSource,
      new StatsStreakService(dataSource.getRepository(Entry)),
      new ConfigService(dataSource.getRepository(Setting)),
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

  const write = (date: string, diaryId = home.id) =>
    dataSource.getRepository(Entry).save({ userId: writerId, diaryId, date, index: 1, tags: [], content: 'A few lines', visibility: 'private' });

  /** Saves the setting at `at`, as turning it on in Profile then would. */
  const saveAt = async (at: string, changes: { deliveryHour?: number; diaryId?: number | null } = {}) => {
    jest.useFakeTimers({ now: new Date(at), doNotFake: ['nextTick', 'setImmediate'] });
    try {
      return await settings.update(writerId, {
        enabled: true,
        deliveryHour: changes.deliveryHour ?? 20,
        timeZone: 'Europe/Paris',
        diaryId: changes.diaryId ?? null,
      });
    } finally {
      jest.useRealTimers();
    }
  };
  const row = async () =>
    (await dataSource.query(`SELECT next_send_at, TO_CHAR(last_sent_on, 'YYYY-MM-DD') AS last_sent_on FROM writing_reminder_emails`))[0];

  it('reminds once on an evening without writing, with the streak up to yesterday, then waits for tomorrow', async () => {
    await write('2026-11-20');
    await write('2026-11-21', work.id);
    expect((await saveAt('2026-11-22T10:00:00Z')).nextSendAt).toBe('2026-11-22T19:00:00.000Z');

    await expect(delivery.deliverDue(new Date('2026-11-22T18:59:00Z'))).resolves.toBe(0);
    await expect(delivery.deliverDue(EVENING_IN_PARIS)).resolves.toBe(1);

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('writer@example.com');
    expect(sent[0].email.text).toContain('You have written 2 days in a row.');
    expect(sent[0].email.text).toContain('Write today’s entry: https://thoughty.example.com/journal\n');
    expect(await row()).toEqual({ next_send_at: new Date('2026-11-23T19:00:00Z'), last_sent_on: '2026-11-22' });

    // Moving the hour later the same evening does not remind again.
    await saveAt('2026-11-22T19:30:00Z', { deliveryHour: 21 });
    await expect(delivery.deliverDue(new Date('2026-11-22T20:00:00Z'))).resolves.toBe(0);
    expect(sent).toHaveLength(1);
  });

  it('stays quiet on a day already written in its diary, but not for an entry in another diary or in the recycle bin', async () => {
    await saveAt('2026-11-22T10:00:00Z', { diaryId: home.id });
    await write('2026-11-22', work.id);
    const binned = await write('2026-11-22');
    await dataSource.getRepository(Entry).softDelete(binned.id);

    await expect(delivery.deliverDue(EVENING_IN_PARIS)).resolves.toBe(1);
    expect(sent[0].email.text).toContain(`https://thoughty.example.com/journal?diary=${home.id}`);
    expect(sent[0].email.text).not.toContain('in a row');

    await write('2026-11-23');
    await expect(delivery.deliverDue(new Date('2026-11-23T19:00:00Z'))).resolves.toBe(0);
    expect(sent).toHaveLength(1);
    expect(await row()).toEqual({ next_send_at: new Date('2026-11-24T19:00:00Z'), last_sent_on: '2026-11-22' });
  });

  it('turns off from the reminder’s unsubscribe link, and widens to all diaries when its diary is deleted', async () => {
    await saveAt('2026-11-22T10:00:00Z', { diaryId: work.id });
    await dataSource.getRepository(Diary).delete(work.id);
    expect((await settings.get(writerId)).diaryId).toBeNull();

    await expect(unsubscribe.unsubscribe(createEmailUnsubscribeToken('writing-reminder', writerId, SECRET))).resolves.toEqual({
      success: true,
      kind: 'writing-reminder',
    });
    expect((await settings.get(writerId)).enabled).toBe(false);
    await expect(delivery.deliverDue(EVENING_IN_PARIS)).resolves.toBe(0);
  });
});
