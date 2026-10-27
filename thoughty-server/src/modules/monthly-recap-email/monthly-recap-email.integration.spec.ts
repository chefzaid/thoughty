import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Attachment, Diary, Entry, EntryRevision, MonthlyRecapEmail, OnThisDayEmail, Setting, User, YearReviewMood } from '@/database/entities';
import type { RenderedEmail } from '@/modules/auth/services/email.service';
import { ConfigService } from '@/modules/config';
import { EntriesQueryService, EntrySearchService } from '@/modules/entries';
import { createEmailUnsubscribeToken } from '@/modules/opt-in-email/email-unsubscribe-token';
import { EmailUnsubscribeService } from '@/modules/opt-in-email/email-unsubscribe.service';
import { YearReviewService } from '@/modules/review';
import { MonthlyRecapDeliveryService } from './monthly-recap-delivery.service';
import { MonthlyRecapEmailService } from './monthly-recap-email.service';
import { MonthlyRecapService } from './monthly-recap.service';

const SECRET = 'i'.repeat(48);
// 07:00 UTC on 1 November 2026 is 08:00 in Paris, the default hour, on winter time.
const FIRST_OF_NOVEMBER_IN_PARIS = new Date('2026-11-01T07:00:00Z');

describePostgres('PostgreSQL monthly recap email', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let settings: MonthlyRecapEmailService;
  let delivery: MonthlyRecapDeliveryService;
  let unsubscribe: EmailUnsubscribeService;
  let sent: Array<{ to: string; email: RenderedEmail }>;
  let writerId: number;
  let home: Diary;
  let work: Diary;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    const entries = dataSource.getRepository(Entry);
    const queries = new EntriesQueryService(entries, dataSource.getRepository(EntryRevision), new EntrySearchService(entries));
    const review = new YearReviewService(
      entries,
      dataSource.getRepository(Diary),
      dataSource.getRepository(Attachment),
      dataSource.getRepository(YearReviewMood),
      {} as never,
    );
    const emailService = {
      isConfigured: () => true,
      sendRenderedEmail: async (to: string, email: RenderedEmail) => {
        sent.push({ to, email });
      },
    };
    const nestConfig = { get: (key: string, fallback?: string) => ({ UNSUBSCRIBE_SECRET: SECRET, FRONTEND_URL: 'https://thoughty.example.com' })[key] ?? fallback };
    settings = new MonthlyRecapEmailService(
      dataSource.getRepository(MonthlyRecapEmail),
      dataSource.getRepository(Diary),
      dataSource.getRepository(User),
      emailService as never,
    );
    delivery = new MonthlyRecapDeliveryService(
      dataSource,
      new MonthlyRecapService(review, queries),
      new ConfigService(dataSource.getRepository(Setting)),
      emailService as never,
      nestConfig as never,
    );
    unsubscribe = new EmailUnsubscribeService(dataSource.getRepository(OnThisDayEmail), dataSource.getRepository(MonthlyRecapEmail), nestConfig as never);
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    sent = [];
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    writerId = (await dataSource.getRepository(User).save({ username: 'writer', email: 'writer@example.com', emailVerified: true })).id;
    home = await dataSource.getRepository(Diary).save({ userId: writerId, name: 'Home', position: 0 });
    work = await dataSource.getRepository(Diary).save({ userId: writerId, name: 'Work', position: 1 });
  });

  const write = (date: string, content: string, extra: Partial<Entry> = {}, userId = writerId) =>
    dataSource.getRepository(Entry).save({ userId, diaryId: home.id, date, index: 1, tags: [], content, visibility: 'private', ...extra });

  /** Saves the setting at `at`, as turning it on in Profile then would. */
  const saveAt = async (at: string, changes: { userId?: number; deliveryHour?: number; timeZone?: string; diaryId?: number | null } = {}) => {
    jest.useFakeTimers({ now: new Date(at), doNotFake: ['nextTick', 'setImmediate'] });
    try {
      return await settings.update(changes.userId ?? writerId, {
        enabled: true,
        deliveryHour: changes.deliveryHour ?? 8,
        timeZone: changes.timeZone ?? 'Europe/Paris',
        diaryId: changes.diaryId ?? null,
      });
    } finally {
      jest.useRealTimers();
    }
  };

  it('recaps the month just ended on the 1st, once, with its numbers, tags, moods, one memory and the year in review', async () => {
    await write('2026-10-01', 'First of the month by the sea', { tags: ['sea', 'family'], mood: 4 });
    await write('2026-10-31', 'Halloween with the family', { tags: ['family'], mood: 3 });
    await write('2026-10-31', 'A second note', { tags: ['family'] });
    const binned = await write('2026-10-15', 'Thrown away', { tags: ['bin'] });
    await dataSource.getRepository(Entry).softDelete(binned.id);
    await write('2026-09-30', 'September', { tags: ['september'] });
    await write('2026-11-01', 'November already', { tags: ['november'] });
    await write('2019-10-12', 'A long October evening with many many words to read again', { isArchived: true });
    await write('2020-10-03', 'A much longer October evening with many many more words to read again and again');
    const favorite = await write('2021-10-20', 'Short favorite', { isFavorite: true, title: 'The harbour' });
    // Saved during summer time; the 1st of November is already winter time.
    expect((await saveAt('2026-10-10T12:00:00Z')).nextSendAt).toBe('2026-11-01T07:00:00.000Z');

    await expect(delivery.deliverDue(new Date('2026-11-01T06:59:00Z'))).resolves.toBe(0);
    await expect(delivery.deliverDue(FIRST_OF_NOVEMBER_IN_PARIS)).resolves.toBe(1);

    expect(sent).toHaveLength(1);
    const { to, email } = sent[0];
    expect(to).toBe('writer@example.com');
    expect(email.subject).toBe('Your October 2026 in your journal');
    expect(email.text).toContain('- 3 entries\n- 14 words\n- 2 days with writing\n- Top tags: #family (3), #sea (1)');
    expect(email.text).toContain('Average mood: 3.5 out of 5 (Good), from 2 entries with a mood.');
    expect(email.text).toContain('A memory from October 2021\n\n5 years ago · October 20, 2021\nThe harbour\nShort favorite');
    expect(email.text).toContain(`https://thoughty.example.com/journal?entry=${favorite.id}`);
    expect(email.text).toContain('https://thoughty.example.com/review?year=2026');
    for (const absent of ['Thrown away', 'September', 'November already', '#bin', '#november']) {
      expect(email.text).not.toContain(absent);
    }
    const [row] = await dataSource.query(`SELECT next_send_at, TO_CHAR(last_sent_on, 'YYYY-MM-DD') AS last_sent_on FROM monthly_recap_emails`);
    expect(row).toEqual({ next_send_at: new Date('2026-12-01T07:00:00Z'), last_sent_on: '2026-11-01' });

    // Moving the hour later the same day does not send the month again.
    await saveAt('2026-11-01T09:00:00Z', { deliveryHour: 21 });
    await expect(delivery.deliverDue(new Date('2026-11-01T20:00:00Z'))).resolves.toBe(0);
    expect(sent).toHaveLength(1);
  });

  it('picks the longest past entry of the month without a favorite, and sends a memory alone for a month without writing', async () => {
    await write('2019-10-12', 'Short one');
    const longest = await write('2020-10-03', 'The longest October entry of them all');
    await saveAt('2026-10-10T12:00:00Z');

    await expect(delivery.deliverDue(FIRST_OF_NOVEMBER_IN_PARIS)).resolves.toBe(1);
    expect(sent[0].email.text).toContain('You didn’t write in October 2026.');
    expect(sent[0].email.text).not.toContain('Your month in numbers');
    expect(sent[0].email.text).toContain(`/journal?entry=${longest.id}`);
  });

  it('skips a month with neither entries nor a past memory, and overlapping runs send once', async () => {
    await write('2025-11-05', 'Last November');
    await saveAt('2026-10-10T12:00:00Z');
    await expect(delivery.deliverDue(FIRST_OF_NOVEMBER_IN_PARIS)).resolves.toBe(0);
    expect(sent).toHaveLength(0);

    const firstOfDecember = new Date('2026-12-01T07:00:00Z');
    const runs = await Promise.all([delivery.deliverDue(firstOfDecember), delivery.deliverDue(firstOfDecember)]);
    expect(runs.reduce((total, count) => total + count, 0)).toBe(1);
    expect(sent[0].email.text).toContain('A memory from November 2025');
  });

  it('starts the month on each writer’s clock', async () => {
    await write('2026-10-05', 'October in Tokyo');
    const traveller = (await dataSource.getRepository(User).save({ username: 'la', email: 'la@example.com', emailVerified: true })).id;
    await write('2026-10-06', 'October in Los Angeles', { diaryId: null }, traveller);
    await saveAt('2026-10-10T12:00:00Z', { timeZone: 'Asia/Tokyo' });
    await saveAt('2026-10-10T12:00:00Z', { userId: traveller, timeZone: 'America/Los_Angeles' });

    // 23:00 UTC on 31 October is 08:00 on the 1st in Tokyo, but still the 31st in Los Angeles.
    await expect(delivery.deliverDue(new Date('2026-10-31T23:00:00Z'))).resolves.toBe(1);
    expect(sent.map(({ to }) => to)).toEqual(['writer@example.com']);
    // Los Angeles reaches 08:00 on the 1st after its own clocks fall back (PST, UTC-8).
    await expect(delivery.deliverDue(new Date('2026-11-01T16:00:00Z'))).resolves.toBe(1);
    expect(sent.map(({ to }) => to)).toEqual(['writer@example.com', 'la@example.com']);
  });

  it('reads only the chosen diary, which widens to all when it is deleted, and links its year in review', async () => {
    await write('2026-10-05', 'At home');
    await write('2026-10-06', 'At work', { diaryId: work.id, tags: ['office'] });
    await saveAt('2026-10-10T12:00:00Z', { diaryId: work.id });

    await delivery.deliverDue(FIRST_OF_NOVEMBER_IN_PARIS);
    expect(sent[0].email.text).toContain('- 1 entry');
    expect(sent[0].email.text).toContain('#office (1)');
    expect(sent[0].email.text).toContain(`/review?year=2026&diary=${work.id}`);

    await dataSource.getRepository(Diary).delete(work.id);
    expect((await settings.get(writerId)).diaryId).toBeNull();
  });

  it('writes only to verified addresses of live accounts', async () => {
    const unverified = (await dataSource.getRepository(User).save({ username: 'new', email: 'new@example.com' })).id;
    const leaving = (await dataSource.getRepository(User).save({ username: 'gone', email: 'gone@example.com', emailVerified: true })).id;
    for (const userId of [unverified, leaving]) {
      await write('2026-10-05', 'October', { diaryId: null }, userId);
      await saveAt('2026-10-10T12:00:00Z', { userId });
    }
    await dataSource.getRepository(User).update(leaving, { deletedAt: new Date('2026-10-20T00:00:00Z') });

    await expect(delivery.deliverDue(FIRST_OF_NOVEMBER_IN_PARIS)).resolves.toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('stops from the shared signed link without touching "On this day", and goes with the account', async () => {
    await write('2026-10-05', 'October');
    await saveAt('2026-10-10T12:00:00Z');
    await dataSource.query(
      `INSERT INTO on_this_day_emails (user_id, enabled, delivery_hour, time_zone, next_send_at) VALUES ($1, TRUE, 8, 'Europe/Paris', NOW())`,
      [writerId],
    );

    await expect(unsubscribe.unsubscribe(createEmailUnsubscribeToken('monthly-recap', writerId, SECRET))).resolves.toEqual({ success: true, kind: 'monthly-recap' });
    expect(await settings.get(writerId)).toEqual(expect.objectContaining({ enabled: false, nextSendAt: null, timeZone: 'Europe/Paris' }));
    await expect(dataSource.getRepository(OnThisDayEmail).findOneByOrFail({ userId: writerId })).resolves.toEqual(expect.objectContaining({ enabled: true }));
    await expect(delivery.deliverDue(FIRST_OF_NOVEMBER_IN_PARIS)).resolves.toBe(0);

    await dataSource.getRepository(User).delete(writerId);
    await expect(dataSource.getRepository(MonthlyRecapEmail).count()).resolves.toBe(0);
  });
});
