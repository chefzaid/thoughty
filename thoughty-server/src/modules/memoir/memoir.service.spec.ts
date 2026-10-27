import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MemoirService } from './memoir.service';
import { MEMOIR_QUESTIONS } from './memoir-questions';

describe('MemoirService', () => {
  let programRepository: Record<string, jest.Mock>;
  let answerRepository: Record<string, jest.Mock>;
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
    diaryRepository = { findOne: jest.fn().mockResolvedValue(null) };
    userRepository = { findOne: jest.fn().mockResolvedValue({ id: 3, email: 'writer@example.com', emailVerified: true }) };
    diariesService = { create: jest.fn().mockResolvedValue({ id: 11 }), findByName: jest.fn().mockResolvedValue(null) };
    emailService = { isConfigured: jest.fn().mockReturnValue(true) };
    service = new MemoirService(
      programRepository as never,
      answerRepository as never,
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
});
