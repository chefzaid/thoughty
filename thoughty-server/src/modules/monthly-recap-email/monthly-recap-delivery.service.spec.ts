import { Logger } from '@nestjs/common';
import { verifyEmailUnsubscribeToken } from '@/modules/opt-in-email/email-unsubscribe-token';
import { MonthlyRecapDeliveryService } from './monthly-recap-delivery.service';
import type { MonthlyRecap } from './monthly-recap.service';

interface DueRow {
  user_id: number;
  delivery_hour: number;
  time_zone: string;
  diary_id: number | null;
  last_sent_on: string | null;
  email: string | null;
  email_verified: boolean;
}

const recap = (overrides: Partial<MonthlyRecap> = {}): MonthlyRecap => ({
  year: 2026,
  month: 10,
  diaryId: null,
  entries: 3,
  words: 120,
  writingDays: 2,
  topTags: [],
  mood: null,
  memory: null,
  ...overrides,
});

describe('MonthlyRecapDeliveryService', () => {
  // 07:00 UTC on 1 November 2026 is 08:00 in Paris (winter time).
  const now = new Date('2026-11-01T07:00:20Z');
  const secret = 's'.repeat(48);
  let manager: { query: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let monthlyRecapService: { build: jest.Mock };
  let emailService: { isConfigured: jest.Mock; sendRenderedEmail: jest.Mock };
  let service: MonthlyRecapDeliveryService;

  const row = (overrides: Partial<DueRow> = {}): DueRow => ({
    user_id: 3,
    delivery_hour: 8,
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
  const updates = () => manager.query.mock.calls.filter(([sql]) => String(sql).includes('UPDATE monthly_recap_emails'));

  beforeEach(() => {
    manager = { query: jest.fn() };
    dataSource = { transaction: jest.fn(async (work: (value: typeof manager) => unknown) => work(manager)) };
    monthlyRecapService = { build: jest.fn().mockResolvedValue(recap()) };
    emailService = { isConfigured: jest.fn().mockReturnValue(true), sendRenderedEmail: jest.fn().mockResolvedValue(undefined) };
    const values: Record<string, string> = { FRONTEND_URL: 'https://thoughty.example.com', UNSUBSCRIBE_SECRET: secret };
    service = new MonthlyRecapDeliveryService(
      dataSource as never,
      monthlyRecapService as never,
      { getConfig: jest.fn().mockResolvedValue({ language: 'en' }) } as never,
      emailService as never,
      { get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback) } as never,
    );
  });

  it('claims only enabled, due rows of live accounts from its own table', async () => {
    withBatches([]);

    await expect(service.deliverDue(now)).resolves.toBe(0);

    const [sql, params] = manager.query.mock.calls[0];
    expect(sql).toContain('FROM monthly_recap_emails s');
    expect(sql).toContain('WHERE s.enabled AND s.next_send_at <= $1 AND u.deleted_at IS NULL');
    expect(sql).toContain('FOR UPDATE OF s SKIP LOCKED');
    expect(params).toEqual([now, 50]);
  });

  it('recaps the month just ended on the writer’s clock, marks the day, and schedules next month', async () => {
    withBatches([row({ diary_id: 4 })]);

    await expect(service.deliverDue(now)).resolves.toBe(1);

    expect(monthlyRecapService.build).toHaveBeenCalledWith(3, { year: 2026, month: 10 }, 4);
    expect(updates()[0][1]).toEqual([3, new Date('2026-12-01T07:00:00Z'), true, '2026-11-01']);
    const [to, email] = emailService.sendRenderedEmail.mock.calls[0];
    expect(to).toBe('writer@example.com');
    expect(email.subject).toBe('Your October 2026 in your journal');
    const token = new URL(/href="([^"]*unsubscribe[^"]*)"/.exec(email.html)![1].replaceAll('&amp;', '&')).searchParams.get('token')!;
    expect(verifyEmailUnsubscribeToken(token, secret)).toEqual({ kind: 'monthly-recap', userId: 3 });
    expect(email.headers['List-Unsubscribe']).toBe(`<https://thoughty.example.com/api/email-unsubscribe?token=${encodeURIComponent(token)}>`);
  });

  it('dates the month on the writer’s clock: already December in Tokyo, still November in Los Angeles', async () => {
    withBatches([row({ time_zone: 'Asia/Tokyo' }), row({ user_id: 4, time_zone: 'America/Los_Angeles' })]);

    await service.deliverDue(new Date('2026-11-30T23:00:00Z'));

    expect(monthlyRecapService.build).toHaveBeenNthCalledWith(1, 3, { year: 2026, month: 11 }, null);
    expect(monthlyRecapService.build).toHaveBeenNthCalledWith(2, 4, { year: 2026, month: 10 }, null);
    expect(updates()[0][1]).toEqual([3, new Date('2026-12-31T23:00:00Z'), true, '2026-12-01']);
    expect(updates()[1][1]).toEqual([4, new Date('2026-12-01T16:00:00Z'), true, '2026-11-30']);
  });

  it('sends nothing for a month without entries or a memory, and only reschedules', async () => {
    monthlyRecapService.build.mockResolvedValue(null);
    withBatches([row()]);

    await expect(service.deliverDue(now)).resolves.toBe(0);

    expect(updates()[0][1]).toEqual([3, new Date('2026-12-01T07:00:00Z'), false, '2026-11-01']);
    expect(emailService.sendRenderedEmail).not.toHaveBeenCalled();
  });

  it('never sends twice in one local month, even days later, nor to unverified or missing addresses', async () => {
    withBatches([
      row({ user_id: 1, last_sent_on: '2026-11-01' }),
      row({ user_id: 2, email_verified: false }),
      row({ user_id: 5, email: null }),
    ]);
    await expect(service.deliverDue(new Date('2026-11-03T07:00:00Z'))).resolves.toBe(0);
    expect(monthlyRecapService.build).not.toHaveBeenCalled();

    withBatches([row({ user_id: 6, last_sent_on: '2026-10-01' })]);
    await expect(service.deliverDue(now)).resolves.toBe(1);
    expect(monthlyRecapService.build).toHaveBeenCalledWith(6, { year: 2026, month: 10 }, null);
  });

  it('logs a failed email by writer ID and reply code only', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    emailService.sendRenderedEmail.mockRejectedValueOnce(Object.assign(new Error('550 writer@example.com'), { responseCode: 550 }));
    withBatches([row()]);

    await expect(service.deliverDue(now)).resolves.toBe(0);

    expect(warn).toHaveBeenCalledWith('Monthly recap email for user 3 failed: Error 550');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('writer@example.com');
    warn.mockRestore();
  });
});
