import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, Entry, EntryRevision, OnThisDayEmail, Setting, User } from '@/database/entities';
import type { RenderedEmail } from '@/modules/auth/services/email.service';
import { ConfigService } from '@/modules/config';
import { EntriesQueryService, EntrySearchService } from '@/modules/entries';
import { OnThisDayDeliveryService } from './on-this-day-delivery.service';
import { OnThisDayEmailService } from './on-this-day-email.service';
import { createUnsubscribeToken } from './on-this-day-unsubscribe-token';
import { timeCapsuleServiceOn } from '@/modules/time-capsules/time-capsules.test-helpers';

const SECRET = 'i'.repeat(48);
// 07:00 UTC on 2026-10-27 is 08:00 in Paris, the default hour.
const AT_EIGHT_IN_PARIS = new Date('2026-10-27T07:00:00Z');

describePostgres('PostgreSQL On this day email', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let settings: OnThisDayEmailService;
  let delivery: OnThisDayDeliveryService;
  let sent: Array<{ to: string; email: RenderedEmail }>;
  let writerId: number;
  let home: Diary;
  let work: Diary;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    const entries = dataSource.getRepository(Entry);
    const queries = new EntriesQueryService(entries, dataSource.getRepository(EntryRevision), new EntrySearchService(entries), timeCapsuleServiceOn(dataSource));
    const emailService = {
      isConfigured: () => true,
      sendRenderedEmail: async (to: string, email: RenderedEmail) => {
        sent.push({ to, email });
      },
    };
    const nestConfig = { get: (key: string, fallback?: string) => ({ UNSUBSCRIBE_SECRET: SECRET, FRONTEND_URL: 'https://thoughty.example.com' })[key] ?? fallback };
    settings = new OnThisDayEmailService(
      dataSource.getRepository(OnThisDayEmail),
      dataSource.getRepository(Diary),
      dataSource.getRepository(User),
      emailService as never,
      nestConfig as never,
    );
    delivery = new OnThisDayDeliveryService(
      dataSource,
      queries,
      new ConfigService(dataSource.getRepository(Setting)),
      emailService as never,
      nestConfig as never,
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

  const write = (date: string, content: string, diary = home, userId = writerId) =>
    dataSource.getRepository(Entry).save({ userId, diaryId: diary.id, date, index: 1, tags: [], content, visibility: 'private' });

  /** Turns the email on for a writer, as saving it in Profile the day before would. */
  const optIn = async (userId: number, diaryId: number | null = null) => {
    jest.useFakeTimers({ now: new Date('2026-10-26T12:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    try {
      return await settings.update(userId, { enabled: true, deliveryHour: 8, timeZone: 'Europe/Paris', diaryId });
    } finally {
      jest.useRealTimers();
    }
  };

  it('sends the past years’ entries for the day once, private ones included and the recycle bin left out', async () => {
    const lake = await write('2023-10-27', 'We swam at the lake');
    await write('2025-10-27', 'A private thought');
    const binned = await write('2024-10-27', 'Thrown away');
    await dataSource.getRepository(Entry).softDelete(binned.id);
    await write('2026-10-27', 'Written today');
    await write('2023-10-26', 'The day before');
    expect((await optIn(writerId)).nextSendAt).toBe('2026-10-27T07:00:00.000Z');

    await expect(delivery.deliverDue(new Date('2026-10-27T06:59:00Z'))).resolves.toBe(0);
    await expect(delivery.deliverDue(AT_EIGHT_IN_PARIS)).resolves.toBe(1);

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('writer@example.com');
    expect(sent[0].email.text).toContain('A private thought');
    expect(sent[0].email.text).toContain('We swam at the lake');
    expect(sent[0].email.text).toContain(`https://thoughty.example.com/journal?entry=${lake.id}`);
    expect(sent[0].email.text).not.toContain('Thrown away');
    expect(sent[0].email.text).not.toContain('Written today');
    expect(sent[0].email.text).not.toContain('The day before');
    const [row] = await dataSource.query(`SELECT next_send_at, TO_CHAR(last_sent_on, 'YYYY-MM-DD') AS last_sent_on FROM on_this_day_emails`);
    expect(row).toEqual({ next_send_at: new Date('2026-10-28T07:00:00Z'), last_sent_on: '2026-10-27' });
  });

  it('never sends a second email the same local day, even when the hour moves later', async () => {
    await write('2023-10-27', 'Lake');
    await optIn(writerId);
    await delivery.deliverDue(AT_EIGHT_IN_PARIS);

    jest.useFakeTimers({ now: new Date('2026-10-27T09:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    try {
      await settings.update(writerId, { enabled: true, deliveryHour: 21, timeZone: 'Europe/Paris', diaryId: null });
    } finally {
      jest.useRealTimers();
    }
    await expect(delivery.deliverDue(new Date('2026-10-27T20:00:00Z'))).resolves.toBe(0);
    expect(sent).toHaveLength(1);
  });

  it('skips days without past entries, and overlapping runs send once', async () => {
    await optIn(writerId);
    await expect(delivery.deliverDue(AT_EIGHT_IN_PARIS)).resolves.toBe(0);
    expect(sent).toHaveLength(0);

    await write('2020-10-28', 'Six years ago');
    const nextDay = new Date('2026-10-28T07:00:00Z');
    const runs = await Promise.all([delivery.deliverDue(nextDay), delivery.deliverDue(nextDay)]);
    expect(runs.reduce((total, count) => total + count, 0)).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it('reads only the chosen diary, which widens to all when it is deleted', async () => {
    await write('2023-10-27', 'At home');
    await write('2024-10-27', 'At work', work);
    await optIn(writerId, work.id);

    await delivery.deliverDue(AT_EIGHT_IN_PARIS);
    expect(sent[0].email.text).toContain('At work');
    expect(sent[0].email.text).not.toContain('At home');

    await dataSource.getRepository(Diary).delete(work.id);
    expect((await settings.get(writerId)).diaryId).toBeNull();
  });

  it('writes only to verified addresses of live accounts', async () => {
    const unverified = (await dataSource.getRepository(User).save({ username: 'new', email: 'new@example.com' })).id;
    const leaving = (await dataSource.getRepository(User).save({ username: 'gone', email: 'gone@example.com', emailVerified: true })).id;
    for (const userId of [unverified, leaving]) {
      await dataSource.getRepository(Entry).save({ userId, date: '2023-10-27', index: 1, tags: [], content: 'Past' });
      await optIn(userId);
    }
    await dataSource.getRepository(User).update(leaving, { deletedAt: new Date('2026-10-20T00:00:00Z') });

    await expect(delivery.deliverDue(AT_EIGHT_IN_PARIS)).resolves.toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('stops from the signed link without signing in, and goes with the account', async () => {
    await write('2023-10-27', 'Lake');
    await optIn(writerId);

    await settings.unsubscribe(createUnsubscribeToken(writerId, SECRET));
    expect(await settings.get(writerId)).toEqual(expect.objectContaining({ enabled: false, nextSendAt: null, timeZone: 'Europe/Paris' }));
    await expect(delivery.deliverDue(AT_EIGHT_IN_PARIS)).resolves.toBe(0);

    await dataSource.getRepository(User).delete(writerId);
    await expect(dataSource.getRepository(OnThisDayEmail).count()).resolves.toBe(0);
  });
});
