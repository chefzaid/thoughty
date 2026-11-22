import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { MemoirService } from './memoir.service';
import { memoirQuestionsFor } from './memoir-questions';

// Every writer's year of questions, without themes
const YEAR_QUESTIONS = memoirQuestionsFor([]);

describe('MemoirService', () => {
  let programRepository: Record<string, jest.Mock>;
  let answerRepository: Record<string, jest.Mock>;
  let snoozeRepository: Record<string, jest.Mock>;
  let diaryRepository: Record<string, jest.Mock>;
  let userRepository: Record<string, jest.Mock>;
  let diariesService: Record<string, jest.Mock>;
  let emailService: Record<string, jest.Mock>;
  let photoAnswerRepository: Record<string, jest.Mock>;
  let service: MemoirService;

  const program = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    userId: 3,
    diaryId: 6,
    status: 'active',
    emailEnabled: true,
    deliveryWeekday: 0,
    timeZone: 'UTC',
    themes: [],
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
    photoAnswerRepository = { find: jest.fn().mockResolvedValue([]) };
    service = new MemoirService(
      programRepository as never,
      answerRepository as never,
      snoozeRepository as never,
      diaryRepository as never,
      userRepository as never,
      diariesService as never,
      emailService as never,
      photoAnswerRepository as never,
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
      expect(overview.themes.map((theme) => theme.id)).toEqual(['parenthood', 'careers', 'migration', 'history', 'faith']);
      expect(overview.themes[2]).toEqual({ id: 'migration', title: { en: 'Migration', fr: 'Migration' }, questionCount: 7 });
    });

    it('adds the chosen themes to the chapters and the count, and keeps words from a theme left out', async () => {
      programRepository.findOne.mockResolvedValue(program({ themes: ['faith', 'parenthood'] }));
      answerRepository.find.mockResolvedValue([
        { ...answered('parenthood-names'), entry: { id: 90, content: 'one two three' } },
        { ...answered('migration-journey'), entryId: 91, entry: { id: 91, content: 'four five' } },
      ]);

      const overview = await service.getOverview(3);

      expect(overview.program?.themes).toEqual(['faith', 'parenthood']);
      expect(overview.chapters.map((chapter) => chapter.id)).toEqual([
        'childhood', 'growing-up', 'family', 'love', 'parenthood', 'work', 'places', 'faith', 'lessons',
      ]);
      expect(overview.chapters[4].questions[2].answer).toEqual({ entryId: 90, answeredAt: '2026-10-10T09:00:00.000Z' });
      expect(overview.progress).toEqual({ answered: 1, total: 66, words: 5, estimatedPages: 1 });
      expect(overview.themes).toHaveLength(5);
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
        themes: [],
        currentQuestionId: 'childhood-home',
        nextDeliveryAt: '2026-10-25T09:00:00.000Z',
        startedAt: '2026-10-04T15:20:00.000Z',
      });
      expect(overview.chapters[0].questions[0].answer).toEqual({ entryId: 81, answeredAt: '2026-10-05T09:00:00.000Z' });
      expect(overview.chapters[0].questions[1].answer).toBeNull();
      expect(overview.progress).toEqual({ answered: 1, total: 52, words: 302, estimatedPages: 2 });
      expect(answerRepository.find).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 3 } }));
    });

    it('lists the photo stories newest first and counts their words without the photo, the binned and the locked', async () => {
      programRepository.findOne.mockResolvedValue(program());
      photoAnswerRepository.find.mockResolvedValue([
        { entryId: 95, createdAt: new Date('2026-10-12T09:00:00Z'), entry: { id: 95, content: '### What is happening here?\n\n![Bakery](attachment:4)\n\nGrandpa opens shop' } },
        { entryId: 94, createdAt: new Date('2026-10-11T09:00:00Z'), entry: { id: 94, userId: 3, content: 'secret words', isLocked: true } },
        { entryId: 93, createdAt: new Date('2026-10-10T09:00:00Z'), entry: null },
      ]);

      const overview = await service.getOverview(3);

      expect(overview.photoAnswers).toEqual([
        { entryId: 95, answeredAt: '2026-10-12T09:00:00.000Z' },
        { entryId: 94, answeredAt: '2026-10-11T09:00:00.000Z' },
      ]);
      expect(overview.progress).toEqual({ answered: 0, total: 52, words: 3, estimatedPages: 1 });
      expect(photoAnswerRepository.find).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: 3 },
        order: { createdAt: 'DESC', entryId: 'DESC' },
      }));
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
      answerRepository.find.mockResolvedValue([answered(YEAR_QUESTIONS[0].id)]);

      await service.start(3, { ...start, diaryName: 'My memoir' });

      expect(diariesService.create).toHaveBeenCalledWith(3, { name: 'My memoir', icon: '📖', visibility: 'private' });
      expect(programRepository.insert).toHaveBeenCalledWith({
        userId: 3,
        diaryId: 11,
        status: 'active',
        emailEnabled: true,
        deliveryWeekday: 3,
        timeZone: 'Europe/Paris',
        themes: [],
        currentQuestionId: YEAR_QUESTIONS[1].id,
        currentQuestionAt: new Date('2026-10-19T10:00:00Z'),
        nextDeliveryAt: new Date('2026-10-21T07:00:00Z'),
      });
    });

    it('starts with the chosen themes, kept once each in life order', async () => {
      await service.start(3, { ...start, diaryName: 'My memoir', themes: ['faith', 'migration', 'faith'] });

      expect(programRepository.insert).toHaveBeenCalledWith(
        expect.objectContaining({ themes: ['migration', 'faith'], currentQuestionId: 'childhood-home' }),
      );
    });

    it('opens on a chosen theme when the year is already answered', async () => {
      answerRepository.find.mockResolvedValue(YEAR_QUESTIONS.map((question) => answered(question.id)));

      await service.start(3, { ...start, diaryName: 'My memoir', themes: ['history'] });

      expect(programRepository.insert).toHaveBeenCalledWith(expect.objectContaining({ currentQuestionId: 'history-news' }));
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

    it('adds a theme and keeps this week\'s question', async () => {
      programRepository.findOne.mockResolvedValue(program());

      await service.update(3, { themes: ['careers', 'parenthood'] });

      expect(programRepository.save).toHaveBeenCalledTimes(1);
      expect(programRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ themes: ['parenthood', 'careers'], currentQuestionId: 'childhood-home' }),
      );
    });

    it('leaves the themes alone when the same list comes back', async () => {
      programRepository.findOne.mockResolvedValue(program({ themes: ['faith'], currentQuestionId: null }));

      await service.update(3, { themes: ['faith'] });

      expect(programRepository.save).toHaveBeenCalledWith(expect.objectContaining({ themes: ['faith'], currentQuestionId: null }));
      // Only the overview reads what was set aside: no new question was looked for
      expect(snoozeRepository.find).toHaveBeenCalledTimes(1);
    });

    it('offers the next question at once when this week\'s leaves with its theme', async () => {
      programRepository.findOne.mockResolvedValue(program({ themes: ['parenthood'], currentQuestionId: 'parenthood-names' }));

      await service.update(3, { themes: [] });

      expect(programRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ themes: [], currentQuestionId: 'work-path', currentQuestionAt: new Date('2026-10-19T10:00:00Z') }),
      );
    });

    it('offers a question from a new theme once the memoir was finished', async () => {
      programRepository.findOne.mockResolvedValue(program({ currentQuestionId: null }));
      answerRepository.find.mockResolvedValue(YEAR_QUESTIONS.map((question) => answered(question.id)));

      await service.update(3, { themes: ['faith'] });

      expect(programRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ themes: ['faith'], currentQuestionId: 'faith-upbringing' }),
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
    programRepository.findOne.mockResolvedValue(program({ currentQuestionId: YEAR_QUESTIONS[0].id }));
    answerRepository.find.mockResolvedValue([answered(YEAR_QUESTIONS[1].id)]);

    await service.skip(3);

    expect(programRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ currentQuestionId: YEAR_QUESTIONS[2].id, currentQuestionAt: new Date('2026-10-19T10:00:00Z') }),
    );
  });

  it('leaves the program but keeps the answers', async () => {
    await expect(service.leave(3)).resolves.toEqual({ success: true });
    expect(programRepository.delete).toHaveBeenCalledWith({ userId: 3 });
  });
  describe('Not this week', () => {
    const snoozed = (questionId: string, snoozedUntil: string) => ({ questionId, snoozedUntil });
    const ids = YEAR_QUESTIONS.map((question) => question.id);
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
