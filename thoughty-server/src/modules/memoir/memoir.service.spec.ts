import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { MemoirService } from './memoir.service';
import { MEMOIR_QUESTIONS } from './memoir-questions';

describe('MemoirService', () => {
  let programRepository: Record<string, jest.Mock>;
  let answerRepository: Record<string, jest.Mock>;
  let snoozeRepository: Record<string, jest.Mock>;
  let diaryRepository: Record<string, jest.Mock>;
  let userRepository: Record<string, jest.Mock>;
  let diariesService: Record<string, jest.Mock>;
  let emailService: Record<string, jest.Mock>;
  let service: MemoirService;

  const program = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    userId: 3,
    diaryId: 6,
    status: 'active',
    emailEnabled: true,
    deliveryWeekday: 0,
    timeZone: 'UTC',
    currentQuestionId: 'childhood-home',
    currentQuestionAt: new Date('2026-10-18T09:00:00Z'),
    nextDeliveryAt: new Date('2026-10-25T09:00:00Z'),
    lastEmailedAt: null,
    createdAt: new Date('2026-10-04T15:20:00Z'),
    ...overrides,
  });

  const answered = (questionId: string) => ({
    questionId,
    entryId: 90,
    createdAt: new Date('2026-10-10T09:00:00Z'),
    entry: { id: 90, content: '### Question\n\nAnswer' },
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-19T10:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    programRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      exists: jest.fn().mockResolvedValue(false),
      insert: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockImplementation(async (value) => value),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    answerRepository = { find: jest.fn().mockResolvedValue([]) };
    snoozeRepository = {
      find: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    diaryRepository = { findOne: jest.fn().mockResolvedValue(null) };
    userRepository = { findOne: jest.fn().mockResolvedValue({ id: 3, email: 'writer@example.com', emailVerified: true }) };
    diariesService = { create: jest.fn().mockResolvedValue({ id: 11 }), findByName: jest.fn().mockResolvedValue(null) };
    emailService = { isConfigured: jest.fn().mockReturnValue(true) };
    service = new MemoirService(
      programRepository as never,
      answerRepository as never,
      snoozeRepository as never,
      diaryRepository as never,
      userRepository as never,
      diariesService as never,
      emailService as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getOverview', () => {
    it('lists every chapter and question before the program starts', async () => {
      const overview = await service.getOverview(3);

      expect(overview.program).toBeNull();
      expect(overview.chapters).toHaveLength(7);
      expect(overview.chapters.flatMap((chapter) => chapter.questions)).toHaveLength(52);
      expect(overview.progress).toEqual({ answered: 0, total: 52, words: 0, estimatedPages: 0 });
    });

    it('marks answered questions with their entries and totals the words written', async () => {
      programRepository.findOne.mockResolvedValue(program());
      answerRepository.find.mockResolvedValue([
        {
          questionId: 'childhood-home',
          entryId: 81,
          createdAt: new Date('2026-10-05T09:00:00Z'),
          entry: { id: 81, content: `### Home?\n\n${'word '.repeat(300)}` },
        },
        { questionId: 'retired-question', entryId: 82, createdAt: new Date('2026-10-06T09:00:00Z'), entry: { id: 82, content: 'Old answer' } },
        // In the recycle bin: the join leaves the entry out
        { questionId: 'childhood-earliest-memory', entryId: 83, createdAt: new Date('2026-10-07T09:00:00Z'), entry: null },
      ]);

      const overview = await service.getOverview(3);

      expect(overview.program).toEqual({
        diaryId: 6,
        status: 'active',
        emailEnabled: true,
        emailAvailable: true,
        deliveryWeekday: 0,
        timeZone: 'UTC',
        currentQuestionId: 'childhood-home',
        nextDeliveryAt: '2026-10-25T09:00:00.000Z',
        startedAt: '2026-10-04T15:20:00.000Z',
      });
      expect(overview.chapters[0].questions[0].answer).toEqual({ entryId: 81, answeredAt: '2026-10-05T09:00:00.000Z' });
      expect(overview.chapters[0].questions[1].answer).toBeNull();
      expect(overview.progress).toEqual({ answered: 1, total: 52, words: 302, estimatedPages: 2 });
      expect(answerRepository.find).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 3 } }));
    });

    it('reports that emails cannot arrive without a verified address or mail server', async () => {
      programRepository.findOne.mockResolvedValue(program());
      userRepository.findOne.mockResolvedValue({ id: 3, email: 'writer@example.com', emailVerified: false });
      expect((await service.getOverview(3)).program?.emailAvailable).toBe(false);

      userRepository.findOne.mockResolvedValue({ id: 3, email: 'writer@example.com', emailVerified: true });
      emailService.isConfigured.mockReturnValue(false);
      expect((await service.getOverview(3)).program?.emailAvailable).toBe(false);
    });
  });

  describe('start', () => {
    const start = { emailEnabled: true, deliveryWeekday: 3, timeZone: 'Europe/Paris' };

    it('creates a private memoir diary and offers the first unanswered question right away', async () => {
      answerRepository.find.mockResolvedValue([answered(MEMOIR_QUESTIONS[0].id)]);

      await service.start(3, { ...start, diaryName: 'My memoir' });

      expect(diariesService.create).toHaveBeenCalledWith(3, { name: 'My memoir', icon: '📖', visibility: 'private' });
      expect(programRepository.insert).toHaveBeenCalledWith({
        userId: 3,
        diaryId: 11,
        status: 'active',
        emailEnabled: true,
        deliveryWeekday: 3,
        timeZone: 'Europe/Paris',
        currentQuestionId: MEMOIR_QUESTIONS[1].id,
        currentQuestionAt: new Date('2026-10-19T10:00:00Z'),
        nextDeliveryAt: new Date('2026-10-21T07:00:00Z'),
      });
    });

    it('continues in an existing diary with the same name when the memoir is restarted', async () => {
      diariesService.findByName.mockResolvedValue({ id: 6, userId: 3, name: 'My memoir' });

      await service.start(3, { ...start, diaryName: ' my Memoir ' });

      expect(diariesService.findByName).toHaveBeenCalledWith(3, ' my Memoir ');
      expect(diariesService.create).not.toHaveBeenCalled();
      expect(programRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ diaryId: 6 }));
    });

    it('continues in the diary a parallel request created first under the same name', async () => {
      diariesService.findByName.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 7, userId: 3 });
      diariesService.create.mockRejectedValueOnce(new ConflictException());

      await service.start(3, { ...start, diaryName: 'My memoir' });

      expect(programRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ diaryId: 7 }));
    });

    it('passes on a failure to create the memoir diary', async () => {
      const failure = new Error('database down');
      diariesService.create.mockRejectedValueOnce(failure);
      await expect(service.start(3, { ...start, diaryName: 'My memoir' })).rejects.toBe(failure);

      diariesService.create.mockRejectedValueOnce(new ConflictException());
      await expect(service.start(3, { ...start, diaryName: 'My memoir' })).rejects.toThrow(ConflictException);
      expect(programRepository.insert).not.toHaveBeenCalled();
    });

    it('uses a chosen diary only when the writer owns it', async () => {
      diaryRepository.findOne.mockResolvedValueOnce({ id: 4, userId: 3 });
      await service.start(3, { ...start, diaryId: 4 });
      expect(diaryRepository.findOne).toHaveBeenCalledWith({ where: { id: 4, userId: 3 } });
      expect(programRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ diaryId: 4 }));

      diaryRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.start(3, { ...start, diaryId: 99 })).rejects.toThrow(NotFoundException);
    });

    it('refuses a second program, an unknown time zone, and a concurrent duplicate start', async () => {
      programRepository.exists.mockResolvedValueOnce(true);
      await expect(service.start(3, { ...start, diaryName: 'Memoir' })).rejects.toThrow(ConflictException);

      await expect(service.start(3, { ...start, timeZone: 'Mars/Olympus', diaryName: 'Memoir' })).rejects.toThrow(
        BadRequestException,
      );

      programRepository.insert.mockRejectedValueOnce({ code: '23505' });
      await expect(service.start(3, { ...start, diaryName: 'Memoir' })).rejects.toThrow(ConflictException);

      programRepository.insert.mockRejectedValueOnce(new Error('connection lost'));
      await expect(service.start(3, { ...start, diaryName: 'Memoir' })).rejects.toThrow('connection lost');
    });
  });

  describe('update', () => {
    it('requires a started program', async () => {
      await expect(service.update(3, { status: 'paused' })).rejects.toThrow(NotFoundException);
      await expect(service.skip(3)).rejects.toThrow(NotFoundException);
    });

    it('pauses without moving the next delivery', async () => {
      programRepository.findOne.mockResolvedValue(program());

      await service.update(3, { status: 'paused', emailEnabled: false });

      expect(programRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'paused', emailEnabled: false, nextDeliveryAt: new Date('2026-10-25T09:00:00Z') }),
      );
    });

    it('reschedules from now when the day or zone changes, or the program resumes', async () => {
      programRepository.findOne.mockResolvedValue(program());
      await service.update(3, { deliveryWeekday: 2 });
      expect(programRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ deliveryWeekday: 2, nextDeliveryAt: new Date('2026-10-20T09:00:00Z') }),
      );

      programRepository.findOne.mockResolvedValue(program({ timeZone: 'UTC' }));
      await service.update(3, { timeZone: 'Asia/Tokyo' });
      expect(programRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ timeZone: 'Asia/Tokyo', nextDeliveryAt: new Date('2026-10-25T00:00:00Z') }),
      );

      programRepository.findOne.mockResolvedValue(program({ status: 'paused', nextDeliveryAt: new Date('2026-09-01T09:00:00Z') }));
      await service.update(3, { status: 'active' });
      expect(programRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'active', nextDeliveryAt: new Date('2026-10-25T09:00:00Z') }),
      );
    });

    it('moves the memoir to another owned diary and validates the zone', async () => {
      programRepository.findOne.mockResolvedValue(program());
      diaryRepository.findOne.mockResolvedValueOnce({ id: 8, userId: 3 });
      await service.update(3, { diaryId: 8 });
      expect(programRepository.save).toHaveBeenLastCalledWith(expect.objectContaining({ diaryId: 8 }));

      diaryRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.update(3, { diaryId: 50 })).rejects.toThrow(NotFoundException);
      await expect(service.update(3, { timeZone: 'Nowhere/City' })).rejects.toThrow(BadRequestException);
    });
  });

  it('skips to the next unanswered question', async () => {
    programRepository.findOne.mockResolvedValue(program({ currentQuestionId: MEMOIR_QUESTIONS[0].id }));
    answerRepository.find.mockResolvedValue([answered(MEMOIR_QUESTIONS[1].id)]);

    await service.skip(3);

    expect(programRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ currentQuestionId: MEMOIR_QUESTIONS[2].id, currentQuestionAt: new Date('2026-10-19T10:00:00Z') }),
    );
  });

  it('leaves the program but keeps the answers', async () => {
    await expect(service.leave(3)).resolves.toEqual({ success: true });
    expect(programRepository.delete).toHaveBeenCalledWith({ userId: 3 });
  });
  describe('Not this week', () => {
    const snoozed = (questionId: string, snoozedUntil: string) => ({ questionId, snoozedUntil });
    const ids = MEMOIR_QUESTIONS.map((question) => question.id);
    const monday = (timeZone: string) => program({ deliveryWeekday: 1, timeZone, currentQuestionId: ids[0] });

    it('shows the day a set-aside question comes back, until that day or its answer', async () => {
      programRepository.findOne.mockResolvedValue(program());
      answerRepository.find.mockResolvedValue([answered(ids[3])]);
      snoozeRepository.find.mockResolvedValue([
        snoozed(ids[1], '2026-11-09'),
        snoozed(ids[2], '2026-10-19'),
        snoozed(ids[3], '2026-11-09'),
      ]);

      const questions = (await service.getOverview(3)).chapters[0].questions;

      expect(questions.map((question) => question.snoozedUntil).slice(0, 4)).toEqual([null, '2026-11-09', null, null]);
      expect(snoozeRepository.find).toHaveBeenCalledWith(expect.objectContaining({ where: { programId: 1 } }));
    });

    it('sets the question aside until the fourth delivery in Kiritimati (UTC+14), across the week boundary', async () => {
      programRepository.findOne.mockResolvedValue(monday('Pacific/Kiritimati'));
      // Sunday 18:30 UTC is Monday 08:30 there: this Monday's delivery is still ahead
      jest.setSystemTime(new Date('2026-11-01T18:30:00Z'));
      await service.snooze(3);
      expect(snoozeRepository.upsert).toHaveBeenLastCalledWith(
        { programId: 1, questionId: ids[0], snoozedUntil: '2026-11-23' },
        ['programId', 'questionId'],
      );
      expect(programRepository.save).toHaveBeenLastCalledWith(expect.objectContaining({ currentQuestionId: ids[1] }));

      programRepository.findOne.mockResolvedValue(monday('Pacific/Kiritimati'));
      jest.setSystemTime(new Date('2026-11-01T19:30:00Z'));
      await service.snooze(3);
      expect(snoozeRepository.upsert.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ snoozedUntil: '2026-11-30' }));
    });

    it('sets the question aside by Pago Pago’s day (UTC-11), still Monday morning there', async () => {
      programRepository.findOne.mockResolvedValue(monday('Pacific/Pago_Pago'));
      jest.setSystemTime(new Date('2026-11-02T19:30:00Z'));

      await service.snooze(3);

      expect(snoozeRepository.upsert.mock.calls[0][0]).toEqual(expect.objectContaining({ snoozedUntil: '2026-11-23' }));
    });

    it('leaves the week without a question when every other unanswered one is set aside', async () => {
      programRepository.findOne.mockResolvedValue(program({ currentQuestionId: ids[51] }));
      answerRepository.find.mockResolvedValue(ids.slice(0, 50).map(answered));
      snoozeRepository.find.mockResolvedValue([snoozed(ids[50], '2026-11-09')]);

      await service.snooze(3);

      expect(programRepository.save).toHaveBeenCalledWith(expect.objectContaining({ currentQuestionId: null }));
    });

    it('skips past set-aside questions, and offers one whose day has come first', async () => {
      programRepository.findOne.mockResolvedValue(program({ currentQuestionId: ids[0] }));
      snoozeRepository.find.mockResolvedValue([snoozed(ids[1], '2026-11-09')]);
      await service.skip(3);
      expect(programRepository.save).toHaveBeenLastCalledWith(expect.objectContaining({ currentQuestionId: ids[2] }));
      expect(snoozeRepository.delete).not.toHaveBeenCalled();

      programRepository.findOne.mockResolvedValue(program({ currentQuestionId: ids[20] }));
      snoozeRepository.find.mockResolvedValue([snoozed(ids[1], '2026-10-19')]);
      await service.skip(3);
      expect(programRepository.save).toHaveBeenLastCalledWith(expect.objectContaining({ currentQuestionId: ids[1] }));
      expect(snoozeRepository.delete).toHaveBeenCalledWith({ programId: 1, questionId: ids[1] });
    });

    it('refuses when there is no open question this week', async () => {
      programRepository.findOne.mockResolvedValue(program({ currentQuestionId: null }));
      await expectApiError(service.snooze(3), ConflictException, 'MEMOIR_NO_OPEN_QUESTION');

      programRepository.findOne.mockResolvedValue(program({ currentQuestionId: ids[0] }));
      answerRepository.find.mockResolvedValue([answered(ids[0])]);
      await expectApiError(service.snooze(3), ConflictException, 'MEMOIR_NO_OPEN_QUESTION');
      expect(snoozeRepository.upsert).not.toHaveBeenCalled();

      programRepository.findOne.mockResolvedValue(null);
      await expect(service.snooze(3)).rejects.toThrow(NotFoundException);
    });
  });
});
