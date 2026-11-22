import { verifyEmailUnsubscribeToken } from '@/modules/opt-in-email/email-unsubscribe-token';
import { WritingReminderDeliveryService } from './writing-reminder-delivery.service';

interface DueRow {
  user_id: number;
  delivery_hour: number;
  time_zone: string;
  diary_id: number | null;
  last_sent_on: string | null;
  email: string | null;
  email_verified: boolean;
}

describe('WritingReminderDeliveryService', () => {
  // 19:00 UTC on 22 November 2026 is 20:00 in Paris (winter time), the default hour.
  const now = new Date('2026-11-22T19:00:20Z');
  const secret = 's'.repeat(48);
  let manager: { query: jest.Mock };
  let streakService: { getStreak: jest.Mock };
  let emailService: { isConfigured: jest.Mock; sendRenderedEmail: jest.Mock };
  let configService: { getConfig: jest.Mock };
  let diaryReminders: { exists: jest.Mock };
  let service: WritingReminderDeliveryService;

  const row = (overrides: Partial<DueRow> = {}): DueRow => ({
    user_id: 3,
    delivery_hour: 20,
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
  const updates = () => manager.query.mock.calls.filter(([sql]) => String(sql).includes('UPDATE writing_reminder_emails'));
  const streak = (writtenToday: boolean, currentStreak: number) => ({ writtenToday, currentStreak, daysSinceLastEntry: null, lastEntry: null });

  beforeEach(() => {
    manager = { query: jest.fn() };
    const dataSource = { transaction: jest.fn(async (work: (value: typeof manager) => unknown) => work(manager)) };
    streakService = { getStreak: jest.fn().mockResolvedValue(streak(false, 4)) };
    configService = { getConfig: jest.fn().mockResolvedValue({ language: 'en' }) };
    emailService = { isConfigured: jest.fn().mockReturnValue(true), sendRenderedEmail: jest.fn().mockResolvedValue(undefined) };
    const values: Record<string, string> = { FRONTEND_URL: 'https://thoughty.example.com', UNSUBSCRIBE_SECRET: secret };
    service = new WritingReminderDeliveryService(
      dataSource as never,
      streakService as never,
      configService as never,
      emailService as never,
      { get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback) } as never,
      (diaryReminders = { exists: jest.fn().mockResolvedValue(false) }) as never,
    );
  });

  it('claims only enabled, due rows of live accounts from its own table', async () => {
    withBatches([]);

    await expect(service.deliverDue(now)).resolves.toBe(0);

    const [sql] = manager.query.mock.calls[0];
    expect(sql).toContain('FROM writing_reminder_emails s');
    expect(sql).toContain('WHERE s.enabled AND s.next_send_at <= $1 AND u.deleted_at IS NULL');
  });

  it('reminds a writer who has not written today on their clock, with the streak, and schedules tomorrow', async () => {
    withBatches([row({ diary_id: 4 })]);

    await expect(service.deliverDue(now)).resolves.toBe(1);

    expect(streakService.getStreak).toHaveBeenCalledWith(3, 4, '2026-11-22');
    expect(updates()[0][1]).toEqual([3, new Date('2026-11-23T19:00:00Z'), true, '2026-11-22']);
    const [to, email] = emailService.sendRenderedEmail.mock.calls[0];
    expect(to).toBe('writer@example.com');
    expect(email.subject).toBe('A few lines for your journal today?');
    expect(email.text).toContain('You have written 4 days in a row.');
    expect(email.text).toContain('https://thoughty.example.com/journal?diary=4');
    const token = new URL(/href="([^"]*unsubscribe[^"]*)"/.exec(email.html)![1].replaceAll('&amp;', '&')).searchParams.get('token')!;
    expect(verifyEmailUnsubscribeToken(token, secret)).toEqual({ kind: 'writing-reminder', userId: 3 });
    expect(email.headers['List-Unsubscribe']).toBe(`<https://thoughty.example.com/api/email-unsubscribe?token=${encodeURIComponent(token)}>`);
  });

  it('counts every diary when the reminder is for all of them, and dates the day on the writer’s clock', async () => {
    // 23:30 UTC on the 22nd is already the 23rd in Tokyo.
    withBatches([row({ time_zone: 'Asia/Tokyo', delivery_hour: 8 })]);

    await service.deliverDue(new Date('2026-11-22T23:30:00Z'));

    expect(streakService.getStreak).toHaveBeenCalledWith(3, undefined, '2026-11-23');
  });

  it('sends nothing on a day already written, and only reschedules', async () => {
    streakService.getStreak.mockResolvedValue(streak(true, 5));
    withBatches([row()]);

    await expect(service.deliverDue(now)).resolves.toBe(0);

    expect(updates()[0][1]).toEqual([3, new Date('2026-11-23T19:00:00Z'), false, '2026-11-22']);
    expect(emailService.sendRenderedEmail).not.toHaveBeenCalled();
  });

  it('leaves the streak out for a writer in quiet mode, and writes in French', async () => {
    configService.getConfig.mockResolvedValue({ language: 'fr', quietMode: 'true' });
    withBatches([row()]);

    await expect(service.deliverDue(now)).resolves.toBe(1);

    const [, email] = emailService.sendRenderedEmail.mock.calls[0];
    expect(email.subject).toBe('Quelques lignes pour votre journal aujourd’hui ?');
    expect(email.text).not.toContain('d’affilée');
  });

  it('leaves a chosen diary with its own hour to that diary’s reminder, but still reminds for all diaries', async () => {
    diaryReminders.exists.mockResolvedValue(true);
    withBatches([row({ diary_id: 4 })]);
    await expect(service.deliverDue(now)).resolves.toBe(0);
    expect(diaryReminders.exists).toHaveBeenCalledWith({ where: { diaryId: 4, enabled: true } });
    expect(streakService.getStreak).not.toHaveBeenCalled();
    expect(updates()[0][1]).toEqual([3, new Date('2026-11-23T19:00:00Z'), false, '2026-11-22']);

    withBatches([row()]);
    await expect(service.deliverDue(now)).resolves.toBe(1);
    expect(diaryReminders.exists).toHaveBeenCalledTimes(1);
  });

  it('never reminds twice in one local day', async () => {
    withBatches([row({ last_sent_on: '2026-11-22' })]);

    await expect(service.deliverDue(now)).resolves.toBe(0);
    expect(streakService.getStreak).not.toHaveBeenCalled();
  });
});
