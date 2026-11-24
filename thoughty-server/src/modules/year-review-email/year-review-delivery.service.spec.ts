import { Logger } from '@nestjs/common';
import { verifyEmailUnsubscribeToken } from '@/modules/opt-in-email/email-unsubscribe-token';
import type { YearRecap } from './year-recap.service';
import { YearReviewDeliveryService } from './year-review-delivery.service';

interface DueRow {
  user_id: number;
  delivery_hour: number;
  time_zone: string;
  diary_id: number | null;
  last_sent_on: string | null;
  email: string | null;
  email_verified: boolean;
}

const recap = (overrides: Partial<YearRecap> = {}): YearRecap => ({
  year: 2026,
  diaryId: null,
  entries: 3,
  words: 120,
  writingDays: 2,
  longestStreak: 2,
  busiestMonth: { month: 5, entries: 3 },
  topTags: [],
  mood: null,
  ...overrides,
});

describe('YearReviewDeliveryService', () => {
  // 08:00 UTC on 1 January 2027 is 09:00 in Paris (winter time).
  const now = new Date('2027-01-01T08:00:20Z');
  const secret = 's'.repeat(48);
  let manager: { query: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let yearRecapService: { build: jest.Mock };
  let emailService: { isConfigured: jest.Mock; sendRenderedEmail: jest.Mock };
  let configService: { getConfig: jest.Mock };
  let service: YearReviewDeliveryService;

  const row = (overrides: Partial<DueRow> = {}): DueRow => ({
    user_id: 3,
    delivery_hour: 9,
    time_zone: 'Europe/Paris',
    diary_id: null,
    last_sent_on: null,
    email: 'writer@example.com',
    email_verified: true,
    ...overrides,
  });
  const withBatches = (...batches: DueRow[][]) => {
    const queue = [...batches];
    manager.query.mockImplementation(async (sql: string) => (sql.includes('SKIP LOCKED') ? queue.shift() ?? [] : []));
  };
  const updates = () => manager.query.mock.calls.filter(([sql]) => String(sql).includes('UPDATE year_review_emails'));

  beforeEach(() => {
    manager = { query: jest.fn() };
    dataSource = { transaction: jest.fn(async (work: (value: typeof manager) => unknown) => work(manager)) };
    yearRecapService = { build: jest.fn().mockResolvedValue(recap()) };
    configService = { getConfig: jest.fn().mockResolvedValue({ language: 'en' }) };
    emailService = { isConfigured: jest.fn().mockReturnValue(true), sendRenderedEmail: jest.fn().mockResolvedValue(undefined) };
    const values: Record<string, string> = { FRONTEND_URL: 'https://thoughty.example.com', UNSUBSCRIBE_SECRET: secret };
    service = new YearReviewDeliveryService(
      dataSource as never,
      yearRecapService as never,
      configService as never,
      emailService as never,
      { get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback) } as never,
    );
  });

  it('claims only enabled, due rows of live accounts from its own table', async () => {
    withBatches([]);

    await expect(service.deliverDue(now)).resolves.toBe(0);

    const [sql, params] = manager.query.mock.calls[0];
    expect(sql).toContain('FROM year_review_emails s');
    expect(sql).toContain('WHERE s.enabled AND s.next_send_at <= $1 AND u.deleted_at IS NULL');
    expect(params).toEqual([now, 50]);
  });

  it('reviews the year just ended on the writer’s clock, marks the day, and schedules next year', async () => {
    withBatches([row({ diary_id: 4 })]);

    await expect(service.deliverDue(now)).resolves.toBe(1);

    expect(yearRecapService.build).toHaveBeenCalledWith(3, 2026, 4);
    expect(updates()[0][1]).toEqual([3, new Date('2028-01-01T08:00:00Z'), true, '2027-01-01']);
    const [to, email] = emailService.sendRenderedEmail.mock.calls[0];
    expect(to).toBe('writer@example.com');
    expect(email.subject).toBe('Your 2026 in your journal');
    const token = new URL(/href="([^"]*unsubscribe[^"]*)"/.exec(email.html)![1].replaceAll('&amp;', '&')).searchParams.get('token')!;
    expect(verifyEmailUnsubscribeToken(token, secret)).toEqual({ kind: 'year-review', userId: 3 });
    expect(email.headers['List-Unsubscribe']).toBe(`<https://thoughty.example.com/api/email-unsubscribe?token=${encodeURIComponent(token)}>`);
  });

  it('leaves the counts out for a writer in quiet mode, in French', async () => {
    configService.getConfig.mockResolvedValue({ language: 'fr', quietMode: 'true' });
    yearRecapService.build.mockResolvedValue(recap({ topTags: [{ tag: 'famille', count: 2 }] }));
    withBatches([row()]);

    await expect(service.deliverDue(now)).resolves.toBe(1);

    const [, email] = emailService.sendRenderedEmail.mock.calls[0];
    expect(email.text).toContain('Votre année\n- Tags populaires : #famille');
    expect(email.text).not.toContain('3 entrées');
    expect(email.text).not.toContain('(2)');
  });

  it('dates the year on the writer’s clock: 2027 starts in Tokyo while it is still 2026 in Los Angeles', async () => {
    withBatches([row({ time_zone: 'Asia/Tokyo' })]);
    await service.deliverDue(new Date('2027-01-01T00:00:00Z'));
    expect(yearRecapService.build).toHaveBeenLastCalledWith(3, 2026, null);
    expect(updates()[0][1]).toEqual([3, new Date('2028-01-01T00:00:00Z'), true, '2027-01-01']);

    withBatches([row({ user_id: 4, time_zone: 'America/Los_Angeles' })]);
    await service.deliverDue(new Date('2027-01-01T17:00:00Z'));
    expect(yearRecapService.build).toHaveBeenLastCalledWith(4, 2026, null);
    expect(updates()[1][1]).toEqual([4, new Date('2028-01-01T17:00:00Z'), true, '2027-01-01']);
  });

  it('sends nothing for a year without entries, and only reschedules', async () => {
    yearRecapService.build.mockResolvedValue(null);
    withBatches([row()]);

    await expect(service.deliverDue(now)).resolves.toBe(0);

    expect(updates()[0][1]).toEqual([3, new Date('2028-01-01T08:00:00Z'), false, '2027-01-01']);
    expect(emailService.sendRenderedEmail).not.toHaveBeenCalled();
  });

  it('never sends twice in one local year, even days later, nor to unverified or missing addresses', async () => {
    withBatches([
      row({ user_id: 1, last_sent_on: '2027-01-01' }),
      row({ user_id: 2, email_verified: false }),
      row({ user_id: 5, email: 'user-5@invalid' }),
    ]);
    await expect(service.deliverDue(new Date('2027-01-03T08:00:00Z'))).resolves.toBe(0);
    expect(yearRecapService.build).not.toHaveBeenCalled();

    withBatches([row({ user_id: 6, last_sent_on: '2026-01-01' })]);
    await expect(service.deliverDue(now)).resolves.toBe(1);
    expect(yearRecapService.build).toHaveBeenCalledWith(6, 2026, null);
  });

  it('logs a failed email by writer ID and reply code only', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    emailService.sendRenderedEmail.mockRejectedValueOnce(Object.assign(new Error('550 writer@example.com'), { responseCode: 550 }));
    withBatches([row()]);

    await expect(service.deliverDue(now)).resolves.toBe(0);

    expect(warn).toHaveBeenCalledWith('Year in review email for user 3 failed: Error 550');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('writer@example.com');
    warn.mockRestore();
  });
});
