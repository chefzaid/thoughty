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

  const withDue = (rows: DueRow[], answered: Record<number, string[]> = {}) => {
    manager.query.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('FOR UPDATE OF p SKIP LOCKED')) return rows;
      if (sql.includes('FROM memoir_answers')) {
        return (answered[params[0] as number] ?? []).map((questionId) => ({ question_id: questionId }));
      }
      return [];
    });
  };

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
});
