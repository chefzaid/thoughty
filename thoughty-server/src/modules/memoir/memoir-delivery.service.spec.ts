import { Logger } from '@nestjs/common';
import { MemoirDeliveryService } from './memoir-delivery.service';
import { MEMOIR_QUESTIONS } from './memoir-questions';

interface DueRow {
  id: number;
  user_id: number;
  current_question_id: string | null;
  delivery_weekday: number;
  time_zone: string;
  email_enabled: boolean;
  email: string | null;
  email_verified: boolean;
}

describe('MemoirDeliveryService', () => {
  const now = new Date('2026-10-25T09:00:30Z');
  let manager: { query: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let programRepository: { update: jest.Mock };
  let configService: { getConfig: jest.Mock };
  let emailService: { isConfigured: jest.Mock; sendMemoirQuestionEmail: jest.Mock };
  let nestConfigService: { get: jest.Mock };
  let service: MemoirDeliveryService;

  const row = (overrides: Partial<DueRow> = {}): DueRow => ({
    id: 1,
    user_id: 3,
    current_question_id: MEMOIR_QUESTIONS[0].id,
    delivery_weekday: 0,
    time_zone: 'UTC',
    email_enabled: true,
    email: 'writer@example.com',
    email_verified: true,
    ...overrides,
  });

  const withDue = (
    rows: DueRow[],
    answered: Record<number, string[]> = {},
    snoozed: Record<number, Record<string, string>> = {},
  ) => {
    manager.query.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('FOR UPDATE OF p SKIP LOCKED')) return rows;
      if (sql.includes('FROM memoir_answers')) {
        return (answered[params[0] as number] ?? []).map((questionId) => ({ question_id: questionId }));
      }
      if (sql.includes('FROM memoir_snoozes')) {
        return Object.entries(snoozed[params[0] as number] ?? {}).map(([questionId, until]) => ({
          question_id: questionId,
          snoozed_until: until,
        }));
      }
      return [];
    });
  };

  const snoozeDeletes = () => manager.query.mock.calls.filter(([sql]) => String(sql).includes('DELETE FROM memoir_snoozes'));

  const updateCalls = () => manager.query.mock.calls.filter(([sql]) => String(sql).includes('UPDATE memoir_programs'));

  beforeEach(() => {
    manager = { query: jest.fn() };
    dataSource = { transaction: jest.fn(async (work: (value: typeof manager) => unknown) => work(manager)) };
    programRepository = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    configService = { getConfig: jest.fn().mockResolvedValue({ language: 'fr' }) };
    emailService = {
      isConfigured: jest.fn().mockReturnValue(true),
      sendMemoirQuestionEmail: jest.fn().mockResolvedValue(undefined),
    };
    nestConfigService = { get: jest.fn().mockReturnValue('https://thoughty.example.com') };
    service = new MemoirDeliveryService(
      dataSource as never,
      programRepository as never,
      configService as never,
      emailService as never,
      nestConfigService as never,
    );
  });

  it('claims only due, active programs of live accounts without blocking other workers', async () => {
    withDue([]);

    await expect(service.deliverDueQuestions(now)).resolves.toBe(0);

    const [sql, params] = manager.query.mock.calls[0];
    expect(sql).toContain("p.status = 'active' AND p.next_delivery_at <= $1 AND u.deleted_at IS NULL");
    expect(sql).toContain('FOR UPDATE OF p SKIP LOCKED');
    expect(params).toEqual([now, 50]);
    expect(emailService.sendMemoirQuestionEmail).not.toHaveBeenCalled();
  });

  it('moves to the next unanswered question, schedules next week, and emails it in the writer’s language', async () => {
    withDue([row()], { 3: [MEMOIR_QUESTIONS[1].id] });

    await expect(service.deliverDueQuestions(now)).resolves.toBe(1);

    expect(updateCalls()[0][1]).toEqual([1, MEMOIR_QUESTIONS[2].id, now, new Date('2026-11-01T09:00:00Z')]);
    expect(emailService.sendMemoirQuestionEmail).toHaveBeenCalledWith('writer@example.com', expect.objectContaining({
      subject: 'Votre question de la semaine pour vos mémoires',
      question: MEMOIR_QUESTIONS[2].text.fr,
      actionUrl: `https://thoughty.example.com/memoir?question=${MEMOIR_QUESTIONS[2].id}`,
    }));
    expect(programRepository.update).toHaveBeenCalledWith({ userId: 3 }, { lastEmailedAt: now });
  });

  it('rotates the question without email when email is off, unverified, or the memoir is complete', async () => {
    const everyQuestion = MEMOIR_QUESTIONS.map((question) => question.id);
    withDue(
      [
        row({ id: 1, user_id: 3, email_enabled: false }),
        row({ id: 2, user_id: 4, email_verified: false }),
        row({ id: 3, user_id: 5, email: null }),
        row({ id: 4, user_id: 6 }),
      ],
      { 6: everyQuestion },
    );

    await expect(service.deliverDueQuestions(now)).resolves.toBe(0);

    expect(updateCalls()).toHaveLength(4);
    expect(updateCalls()[3][1][1]).toBeNull();
    expect(emailService.sendMemoirQuestionEmail).not.toHaveBeenCalled();
  });

  it('keeps delivering when the mail server is missing or one email fails', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    withDue([row({ id: 1, user_id: 3 }), row({ id: 2, user_id: 4, time_zone: 'Retired/Zone' })]);
    emailService.sendMemoirQuestionEmail.mockRejectedValueOnce(new Error('SMTP timeout'));

    await expect(service.deliverDueQuestions(now)).resolves.toBe(2);

    expect(updateCalls()[1][1][3]).toEqual(new Date('2026-11-01T09:00:00Z'));
    expect(emailService.sendMemoirQuestionEmail).toHaveBeenCalledTimes(2);
    expect(programRepository.update).toHaveBeenCalledTimes(1);
    expect(programRepository.update).toHaveBeenCalledWith({ userId: 4 }, { lastEmailedAt: now });
    expect(warn).toHaveBeenCalledWith('Weekly memoir email for user 3 failed: SMTP timeout');

    emailService.sendMemoirQuestionEmail.mockClear();
    emailService.isConfigured.mockReturnValue(false);
    withDue([row()]);
    await service.deliverDueQuestions(now);
    expect(emailService.sendMemoirQuestionEmail).not.toHaveBeenCalled();
    warn.mockRestore();
  });
  describe('questions set aside with “Not this week”', () => {
    const monday = (overrides: Partial<DueRow>) => row({ delivery_weekday: 1, ...overrides });
    const away = { 1: { [MEMOIR_QUESTIONS[5].id]: '2026-11-30' } };

    it('passes over a question until its day and offers it first once that day comes in Kiritimati', async () => {
      // Sunday 29 November 19:00 UTC is Monday 30 November 09:00 in Kiritimati (UTC+14)
      const kiritimatiMonday = new Date('2026-11-29T19:00:30Z');
      withDue([monday({ time_zone: 'Pacific/Kiritimati' })], {}, away);
      await service.deliverDueQuestions(kiritimatiMonday);
      expect(updateCalls()[0][1][1]).toBe(MEMOIR_QUESTIONS[5].id);
      expect(snoozeDeletes()[0][1]).toEqual([1, MEMOIR_QUESTIONS[5].id]);

      // In UTC it is still Sunday 29 November: the question is still away
      manager.query.mockClear();
      withDue([monday({ time_zone: 'UTC' })], {}, away);
      await service.deliverDueQuestions(kiritimatiMonday);
      expect(updateCalls()[0][1][1]).toBe(MEMOIR_QUESTIONS[1].id);
      expect(snoozeDeletes()).toHaveLength(0);
    });

    it('keeps it away in Pago Pago while UTC has already reached its day', async () => {
      // Monday 30 November 09:00 UTC is Sunday 29 November 22:00 in Pago Pago (UTC-11)
      withDue([monday({ time_zone: 'Pacific/Pago_Pago' })], {}, away);
      await service.deliverDueQuestions(new Date('2026-11-30T09:00:30Z'));
      expect(updateCalls()[0][1][1]).toBe(MEMOIR_QUESTIONS[1].id);

      // Pago Pago's own Monday 09:00 is 20:00 UTC
      manager.query.mockClear();
      withDue([monday({ time_zone: 'Pacific/Pago_Pago' })], {}, away);
      await service.deliverDueQuestions(new Date('2026-11-30T20:00:30Z'));
      expect(updateCalls()[0][1][1]).toBe(MEMOIR_QUESTIONS[5].id);
    });

    it('gives the week no question, and sends no email, while every remaining question is away', async () => {
      const allButTwo = MEMOIR_QUESTIONS.slice(2).map((question) => question.id);
      withDue([row({ current_question_id: null })], { 3: allButTwo }, {
        1: { [MEMOIR_QUESTIONS[0].id]: '2026-11-08', [MEMOIR_QUESTIONS[1].id]: '2026-11-15' },
      });

      await expect(service.deliverDueQuestions(now)).resolves.toBe(0);

      expect(updateCalls()[0][1][1]).toBeNull();
      expect(emailService.sendMemoirQuestionEmail).not.toHaveBeenCalled();
    });
  });
});
