import { verifyEmailUnsubscribeToken } from '@/modules/opt-in-email/email-unsubscribe-token';
import { DiaryWritingReminderDeliveryService } from './diary-writing-reminder-delivery.service';

describe('DiaryWritingReminderDeliveryService', () => {
  // 06:00 UTC on 23 November 2026 is 07:00 in Paris (winter time).
  const now = new Date('2026-11-23T06:00:10Z');
  const secret = 's'.repeat(48);
  let manager: { query: jest.Mock };
  let streakService: { getStreak: jest.Mock };
  let emailService: { isConfigured: jest.Mock; sendRenderedEmail: jest.Mock };
  let service: DiaryWritingReminderDeliveryService;

  const dueRow = (lastSentOn: string | null = null) => ({
    user_id: 3,
    delivery_hour: 7,
    time_zone: 'Europe/Paris',
    diary_id: 4,
    last_sent_on: lastSentOn,
    email: 'writer@example.com',
    email_verified: true,
  });
  const withRows = (...rows: Array<ReturnType<typeof dueRow>>) => {
    const queue = [rows];
    manager.query.mockImplementation(async (sql: string) => (sql.includes('SKIP LOCKED') ? queue.shift() ?? [] : []));
  };
  const updates = () => manager.query.mock.calls.filter(([sql]) => String(sql).includes('UPDATE diary_writing_reminders'));
  const streak = (writtenToday: boolean) => ({ writtenToday, currentStreak: 2, daysSinceLastEntry: null, lastEntry: null });

  beforeEach(() => {
    manager = { query: jest.fn() };
    const dataSource = { transaction: jest.fn(async (work: (value: typeof manager) => unknown) => work(manager)) };
    streakService = { getStreak: jest.fn().mockResolvedValue(streak(false)) };
    emailService = { isConfigured: jest.fn().mockReturnValue(true), sendRenderedEmail: jest.fn().mockResolvedValue(undefined) };
    const values: Record<string, string> = { FRONTEND_URL: 'https://thoughty.example.com', UNSUBSCRIBE_SECRET: secret };
    service = new DiaryWritingReminderDeliveryService(
      dataSource as never,
      streakService as never,
      { getConfig: jest.fn().mockResolvedValue({ language: 'en' }) } as never,
      emailService as never,
      { get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback) } as never,
    );
  });

  it('claims the due diary rows and moves each one, by its diary, to tomorrow at its hour', async () => {
    withRows(dueRow());

    await expect(service.deliverDue(now)).resolves.toBe(1);

    expect(manager.query.mock.calls[0][0]).toContain('FROM diary_writing_reminders s');
    const [sql, params] = updates()[0];
    expect(sql).toContain('WHERE diary_id = $1');
    expect(params).toEqual([4, new Date('2026-11-24T06:00:00Z'), true, '2026-11-23']);
  });

  it('reminds about the diary alone, on the writer’s clock, opening the composer on it, with the shared unsubscribe link', async () => {
    withRows(dueRow());

    await service.deliverDue(now);

    expect(streakService.getStreak).toHaveBeenCalledWith(3, 4, '2026-11-23');
    const [to, email] = emailService.sendRenderedEmail.mock.calls[0];
    expect(to).toBe('writer@example.com');
    expect(email.text).toContain('You have written 2 days in a row.');
    expect(email.text).toContain('https://thoughty.example.com/journal?diary=4');
    expect(email.text).toContain('for this diary in Manage Diaries');
    const token = new URL(/href="([^"]*unsubscribe[^"]*)"/.exec(email.html)![1].replaceAll('&amp;', '&')).searchParams.get('token')!;
    expect(verifyEmailUnsubscribeToken(token, secret)).toEqual({ kind: 'writing-reminder', userId: 3 });
  });

  it('sends nothing on a day already written in the diary, or already reminded', async () => {
    streakService.getStreak.mockResolvedValue(streak(true));
    withRows(dueRow());
    await expect(service.deliverDue(now)).resolves.toBe(0);
    expect(updates()[0][1]).toEqual([4, new Date('2026-11-24T06:00:00Z'), false, '2026-11-23']);

    withRows(dueRow('2026-11-23'));
    await expect(service.deliverDue(now)).resolves.toBe(0);
    expect(streakService.getStreak).toHaveBeenCalledTimes(1);
    expect(emailService.sendRenderedEmail).not.toHaveBeenCalled();
  });
});
