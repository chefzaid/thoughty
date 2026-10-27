import { Logger } from '@nestjs/common';
import type { OnThisDayEntry } from '@/modules/entries';
import { OnThisDayDeliveryService } from './on-this-day-delivery.service';
import { verifyUnsubscribeToken } from './on-this-day-unsubscribe-token';

interface DueRow {
  user_id: number;
  delivery_hour: number;
  time_zone: string;
  diary_id: number | null;
  last_sent_on: string | null;
  email: string | null;
  email_verified: boolean;
}

const pastEntry = (id: number, yearsAgo = 2): OnThisDayEntry =>
  ({ entry: { id, date: '2024-10-27', title: 'Lake', content: 'We swam', format: 'plain' }, yearsAgo }) as OnThisDayEntry;

describe('OnThisDayDeliveryService', () => {
  const now = new Date('2026-10-27T07:00:20Z');
  const secret = 's'.repeat(48);
  let manager: { query: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let entriesQueryService: { findOnThisDay: jest.Mock };
  let configService: { getConfig: jest.Mock };
  let emailService: { isConfigured: jest.Mock; sendRenderedEmail: jest.Mock };
  let service: OnThisDayDeliveryService;

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
  const updates = () => manager.query.mock.calls.filter(([sql]) => String(sql).includes('UPDATE on_this_day_emails'));

  beforeEach(() => {
    manager = { query: jest.fn() };
    dataSource = { transaction: jest.fn(async (work: (value: typeof manager) => unknown) => work(manager)) };
    entriesQueryService = { findOnThisDay: jest.fn().mockResolvedValue([pastEntry(11)]) };
    configService = { getConfig: jest.fn().mockResolvedValue({ language: 'fr' }) };
    emailService = { isConfigured: jest.fn().mockReturnValue(true), sendRenderedEmail: jest.fn().mockResolvedValue(undefined) };
    const values: Record<string, string> = { FRONTEND_URL: 'https://thoughty.example.com', UNSUBSCRIBE_SECRET: secret };
    service = new OnThisDayDeliveryService(
      dataSource as never,
      entriesQueryService as never,
      configService as never,
      emailService as never,
      { get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback) } as never,
    );
  });

  it('claims only enabled, due rows of live accounts without blocking other workers', async () => {
    withBatches([]);

    await expect(service.deliverDue(now)).resolves.toBe(0);

    const [sql, params] = manager.query.mock.calls[0];
    expect(sql).toContain('WHERE s.enabled AND s.next_send_at <= $1 AND u.deleted_at IS NULL');
    expect(sql).toContain('FOR UPDATE OF s SKIP LOCKED');
    expect(params).toEqual([now, 50]);
    expect(emailService.sendRenderedEmail).not.toHaveBeenCalled();
  });

  it('sends the day’s past entries in the writer’s language, marks the local day, and schedules tomorrow', async () => {
    withBatches([row({ diary_id: 4 })]);

    await expect(service.deliverDue(now)).resolves.toBe(1);

    expect(entriesQueryService.findOnThisDay).toHaveBeenCalledWith(3, { year: 2026, month: 10, day: 27, diaryId: 4 });
    expect(updates()[0][1]).toEqual([3, new Date('2026-10-28T07:00:00Z'), true, '2026-10-27']);
    const [to, email] = emailService.sendRenderedEmail.mock.calls[0];
    expect(to).toBe('writer@example.com');
    expect(email.subject).toBe('Ce jour-là dans votre journal');
    expect(email.html).toContain('https://thoughty.example.com/journal?entry=11');
    const token = new URL(/href="([^"]*unsubscribe[^"]*)"/.exec(email.html)![1].replaceAll('&amp;', '&')).searchParams.get('token')!;
    expect(verifyUnsubscribeToken(token, secret)).toBe(3);
    expect(email.headers['List-Unsubscribe']).toBe(`<https://thoughty.example.com/api/on-this-day-email/unsubscribe?token=${encodeURIComponent(token)}>`);
  });

  it('dates the day on the writer’s clock', async () => {
    // 07:00 UTC is already the 28th in Tokyo.
    withBatches([row({ time_zone: 'Asia/Tokyo' })]);

    await service.deliverDue(new Date('2026-10-27T23:00:00Z'));

    expect(entriesQueryService.findOnThisDay).toHaveBeenCalledWith(3, { year: 2026, month: 10, day: 28, diaryId: null });
    expect(updates()[0][1]).toEqual([3, new Date('2026-10-28T23:00:00Z'), true, '2026-10-28']);
  });

  it('sends nothing on a day without past entries, and only reschedules', async () => {
    entriesQueryService.findOnThisDay.mockResolvedValue([]);
    withBatches([row()]);

    await expect(service.deliverDue(now)).resolves.toBe(0);

    expect(updates()[0][1]).toEqual([3, new Date('2026-10-28T07:00:00Z'), false, '2026-10-27']);
    expect(emailService.sendRenderedEmail).not.toHaveBeenCalled();
  });

  it('never sends twice on one local day, unverified or missing addresses, or without a mail server', async () => {
    withBatches([
      row({ user_id: 1, last_sent_on: '2026-10-27' }),
      row({ user_id: 2, email_verified: false }),
      row({ user_id: 4, email: null }),
    ]);
    await expect(service.deliverDue(now)).resolves.toBe(0);
    expect(entriesQueryService.findOnThisDay).not.toHaveBeenCalled();
    expect(updates().map(([, params]) => params[2])).toEqual([false, false, false]);

    emailService.isConfigured.mockReturnValue(false);
    withBatches([row()]);
    await expect(service.deliverDue(now)).resolves.toBe(0);
    expect(updates()).toHaveLength(4);
    expect(emailService.sendRenderedEmail).not.toHaveBeenCalled();
  });

  it('reads an unknown stored zone as UTC', async () => {
    withBatches([row({ time_zone: 'Mars/Olympus' })]);

    await service.deliverDue(now);

    expect(updates()[0][1]).toEqual([3, new Date('2026-10-27T08:00:00Z'), true, '2026-10-27']);
  });

  it('works through full batches until the due rows run out', async () => {
    const full = Array.from({ length: 50 }, (_, index) => row({ user_id: index + 1 }));
    withBatches(full, [row({ user_id: 99 })]);

    await expect(service.deliverDue(now)).resolves.toBe(51);

    expect(dataSource.transaction).toHaveBeenCalledTimes(2);
  });

  it('logs a failed email by writer ID and reply code only, and carries on', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const failure = Object.assign(new Error('550 writer@example.com: mailbox unavailable'), { responseCode: 550 });
    emailService.sendRenderedEmail.mockRejectedValueOnce(failure).mockRejectedValueOnce('odd');
    withBatches([row(), row({ user_id: 5 }), row({ user_id: 6 })]);

    await expect(service.deliverDue(now)).resolves.toBe(1);

    expect(warn).toHaveBeenNthCalledWith(1, 'On this day email for user 3 failed: Error 550');
    expect(warn).toHaveBeenNthCalledWith(2, 'On this day email for user 5 failed: unknown error');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('writer@example.com');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('We swam');
    warn.mockRestore();
  });
});
