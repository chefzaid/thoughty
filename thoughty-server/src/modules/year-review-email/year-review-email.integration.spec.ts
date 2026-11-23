import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import {
  Attachment,
  Diary,
  DiaryWritingReminder,
  Entry,
  MonthlyRecapEmail,
  OnThisDayEmail,
  Setting,
  User,
  WritingReminderEmail,
  YearReviewEmail,
  YearReviewMood,
} from '@/database/entities';
import type { RenderedEmail } from '@/modules/auth/services/email.service';
import { ConfigService } from '@/modules/config';
import { createEmailUnsubscribeToken } from '@/modules/opt-in-email/email-unsubscribe-token';
import { EmailUnsubscribeService } from '@/modules/opt-in-email/email-unsubscribe.service';
import { YearReviewService } from '@/modules/review';
import { YearRecapService } from './year-recap.service';
import { YearReviewDeliveryService } from './year-review-delivery.service';
import { YearReviewEmailService } from './year-review-email.service';

const SECRET = 'y'.repeat(48);
// 08:00 UTC on 1 January 2027 is 09:00 in Paris, the default hour, on winter time.
const NEW_YEAR_IN_PARIS = new Date('2027-01-01T08:00:00Z');

describePostgres('PostgreSQL year in review email', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let settings: YearReviewEmailService;
  let delivery: YearReviewDeliveryService;
  let unsubscribe: EmailUnsubscribeService;
  let sent: Array<{ to: string; email: RenderedEmail }>;
  let writerId: number;
  let home: Diary;
  let work: Diary;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    const review = new YearReviewService(
      dataSource.getRepository(Entry),
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
    settings = new YearReviewEmailService(
      dataSource.getRepository(YearReviewEmail),
      dataSource.getRepository(Diary),
      dataSource.getRepository(User),
      emailService as never,
    );
    delivery = new YearReviewDeliveryService(
      dataSource,
      new YearRecapService(review),
      new ConfigService(dataSource.getRepository(Setting)),
      emailService as never,
      nestConfig as never,
    );
    unsubscribe = new EmailUnsubscribeService(
      dataSource.getRepository(OnThisDayEmail),
      dataSource.getRepository(MonthlyRecapEmail),
      dataSource.getRepository(WritingReminderEmail),
      nestConfig as never,
      dataSource.getRepository(DiaryWritingReminder),
      dataSource.getRepository(YearReviewEmail),
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

  const write = (date: string, content: string, extra: Partial<Entry> = {}, userId = writerId) =>
    dataSource.getRepository(Entry).save({ userId, diaryId: home.id, date, index: 1, tags: [], content, visibility: 'private', ...extra });

  /** Saves the setting at `at`, as turning it on in Profile then would. */
  const saveAt = async (at: string, changes: { userId?: number; deliveryHour?: number; timeZone?: string; diaryId?: number | null } = {}) => {
    jest.useFakeTimers({ now: new Date(at), doNotFake: ['nextTick', 'setImmediate'] });
    try {
      return await settings.update(changes.userId ?? writerId, {
        enabled: true,
        deliveryHour: changes.deliveryHour ?? 9,
        timeZone: changes.timeZone ?? 'Europe/Paris',
        diaryId: changes.diaryId ?? null,
      });
    } finally {
      jest.useRealTimers();
    }
  };

  it('reviews the year just ended on January 1, once, without the recycle bin, locked entries or any entry text', async () => {
    await write('2026-03-01', 'Spring by the sea', { tags: ['sea', 'family'], mood: 4 });
    await write('2026-03-02', 'Family lunch', { tags: ['family'], mood: 3 });
    await write('2026-03-03', 'Third day in a row', { tags: ['family'] });
    await write('2026-10-31', 'Halloween', { tags: ['party'] });
    const binned = await write('2026-06-15', 'Thrown away', { tags: ['bin'] });
    await dataSource.getRepository(Entry).softDelete(binned.id);
    await write('2026-07-04', 'Behind the PIN', { tags: ['secret'], isLocked: true });
    await write('2025-12-31', 'The year before', { tags: ['old'] });
    await write('2027-01-01', 'New year already', { tags: ['new'] });
    // Saved during summer time; January 1 is winter time.
    expect((await saveAt('2026-07-10T12:00:00Z')).nextSendAt).toBe('2027-01-01T08:00:00.000Z');

    await expect(delivery.deliverDue(new Date('2027-01-01T07:59:00Z'))).resolves.toBe(0);
    await expect(delivery.deliverDue(NEW_YEAR_IN_PARIS)).resolves.toBe(1);

    expect(sent).toHaveLength(1);
    const { to, email } = sent[0];
    expect(to).toBe('writer@example.com');
    expect(email.subject).toBe('Your 2026 in your journal');
    expect(email.text).toContain(
      '- 4 entries\n- 12 words\n- 4 days with writing\n- Longest streak: 3 days in a row\n- Busiest month: March, with 3 entries\n' +
        '- Top tags: #family (3), #party (1), #sea (1)',
    );
    expect(email.text).toContain('Average mood: 3.5 out of 5 (Good), from 2 entries with a mood.');
    expect(email.text).toContain('https://thoughty.example.com/review?year=2026');
    for (const absent of ['Spring by the sea', 'Halloween', 'Thrown away', 'Behind the PIN', '#bin', '#secret', '#old', '#new']) {
      expect(email.text).not.toContain(absent);
      expect(email.html).not.toContain(absent);
    }
    const [row] = await dataSource.query(`SELECT next_send_at, TO_CHAR(last_sent_on, 'YYYY-MM-DD') AS last_sent_on FROM year_review_emails`);
    expect(row).toEqual({ next_send_at: new Date('2028-01-01T08:00:00Z'), last_sent_on: '2027-01-01' });

    // Moving the hour later the same day does not send the year again.
    await saveAt('2027-01-01T09:00:00Z', { deliveryHour: 21 });
    expect((await settings.get(writerId)).nextSendAt).toBe('2027-01-01T20:00:00.000Z');
    await expect(delivery.deliverDue(new Date('2027-01-01T20:00:00Z'))).resolves.toBe(0);
    expect(sent).toHaveLength(1);
  });

  it('skips a year without entries, and overlapping runs send once', async () => {
    await write('2025-11-05', 'Two years ago');
    await saveAt('2026-07-10T12:00:00Z');
    await expect(delivery.deliverDue(NEW_YEAR_IN_PARIS)).resolves.toBe(0);
    expect(sent).toHaveLength(0);

    await write('2027-05-05', 'Writing again');
    const nextNewYear = new Date('2028-01-01T08:00:00Z');
    const runs = await Promise.all([delivery.deliverDue(nextNewYear), delivery.deliverDue(nextNewYear)]);
    expect(runs.reduce((total, count) => total + count, 0)).toBe(1);
    expect(sent[0].email.subject).toBe('Your 2027 in your journal');
  });

  it('starts the year on each writer’s clock', async () => {
    await write('2026-10-05', 'October in Tokyo');
    const traveller = (await dataSource.getRepository(User).save({ username: 'la', email: 'la@example.com', emailVerified: true })).id;
    await write('2026-10-06', 'October in Los Angeles', { diaryId: null }, traveller);
    await saveAt('2026-07-10T12:00:00Z', { timeZone: 'Asia/Tokyo' });
    await saveAt('2026-07-10T12:00:00Z', { userId: traveller, timeZone: 'America/Los_Angeles' });

    // Midnight UTC on January 1 is 09:00 in Tokyo, but still December 31 in Los Angeles.
    await expect(delivery.deliverDue(new Date('2027-01-01T00:00:00Z'))).resolves.toBe(1);
    expect(sent.map(({ to }) => to)).toEqual(['writer@example.com']);
    await expect(delivery.deliverDue(new Date('2027-01-01T17:00:00Z'))).resolves.toBe(1);
    expect(sent.map(({ to }) => to)).toEqual(['writer@example.com', 'la@example.com']);
  });

  it('reads only the chosen diary, which widens to all when it is deleted, and follows quiet mode and the language', async () => {
    await write('2026-10-05', 'At home', { tags: ['home'] });
    await write('2026-10-06', 'At work', { diaryId: work.id, tags: ['office'] });
    await dataSource.getRepository(Setting).save([
      { userId: writerId, key: 'language', value: 'fr' },
      { userId: writerId, key: 'quietMode', value: 'true' },
    ]);
    await saveAt('2026-07-10T12:00:00Z', { diaryId: work.id });

    await delivery.deliverDue(NEW_YEAR_IN_PARIS);
    expect(sent[0].email.subject).toBe('Votre année 2026 dans votre journal');
    expect(sent[0].email.text).toContain('Votre année\n- Tags populaires : #office');
    expect(sent[0].email.text).not.toContain('#home');
    expect(sent[0].email.text).not.toContain('1 entrée');
    expect(sent[0].email.text).toContain(`/review?year=2026&diary=${work.id}`);

    await dataSource.getRepository(Diary).delete(work.id);
    expect((await settings.get(writerId)).diaryId).toBeNull();
  });

  it('writes only to verified addresses of live accounts', async () => {
    const unverified = (await dataSource.getRepository(User).save({ username: 'new', email: 'new@example.com' })).id;
    const leaving = (await dataSource.getRepository(User).save({ username: 'gone', email: 'gone@example.com', emailVerified: true })).id;
    for (const userId of [unverified, leaving]) {
      await write('2026-10-05', 'October', { diaryId: null }, userId);
      await saveAt('2026-07-10T12:00:00Z', { userId });
    }
    await dataSource.getRepository(User).update(leaving, { deletedAt: new Date('2026-12-20T00:00:00Z') });

    await expect(delivery.deliverDue(NEW_YEAR_IN_PARIS)).resolves.toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('stops from the shared signed link without touching the monthly recap, and goes with the account', async () => {
    await write('2026-10-05', 'October');
    await saveAt('2026-07-10T12:00:00Z');
    await dataSource.query(
      `INSERT INTO monthly_recap_emails (user_id, enabled, delivery_hour, time_zone, next_send_at) VALUES ($1, TRUE, 8, 'Europe/Paris', NOW())`,
      [writerId],
    );

    await expect(unsubscribe.unsubscribe(createEmailUnsubscribeToken('year-review', writerId, SECRET))).resolves.toEqual({ success: true, kind: 'year-review' });
    expect(await settings.get(writerId)).toEqual(expect.objectContaining({ enabled: false, nextSendAt: null, timeZone: 'Europe/Paris' }));
    await expect(dataSource.getRepository(MonthlyRecapEmail).findOneByOrFail({ userId: writerId })).resolves.toEqual(expect.objectContaining({ enabled: true }));
    await expect(delivery.deliverDue(NEW_YEAR_IN_PARIS)).resolves.toBe(0);

    await dataSource.getRepository(User).delete(writerId);
    await expect(dataSource.getRepository(YearReviewEmail).count()).resolves.toBe(0);
  });
});
