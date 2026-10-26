import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { MemoirAnswersService } from './memoir-answers.service';

describe('MemoirAnswersService', () => {
  let programRepository: Record<string, jest.Mock>;
  let answerRepository: Record<string, jest.Mock>;
  let entriesService: Record<string, jest.Mock>;
  let attachmentsService: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;
  let service: MemoirAnswersService;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-19T03:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    programRepository = {
      findOne: jest.fn().mockResolvedValue({ userId: 3, diaryId: 6, timeZone: 'America/Los_Angeles' }),
    };
    answerRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    entriesService = {
      create: jest.fn().mockResolvedValue({ success: true, entryId: 81 }),
      delete: jest.fn().mockResolvedValue({ success: true }),
    };
    attachmentsService = {
      getOwnedAttachment: jest.fn().mockResolvedValue({ id: 31 }),
      linkMultipleToEntry: jest.fn().mockResolvedValue(undefined),
    };
    configService = { getConfig: jest.fn().mockResolvedValue({ language: 'fr' }) };
    service = new MemoirAnswersService(
      programRepository as never,
      answerRepository as never,
      entriesService as never,
      attachmentsService as never,
      configService as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('saves the answer as a private Markdown entry in the memoir diary, tagged with its chapter', async () => {
    const result = await service.answer(3, {
      questionId: 'childhood-home',
      text: 'Une maison étroite avec un figuier.',
      attachmentIds: [31, 31],
    });

    expect(result).toEqual({ questionId: 'childhood-home', entryId: 81 });
    expect(entriesService.create).toHaveBeenCalledWith(3, {
      text: '### À quoi ressemblait la maison de votre enfance : ses pièces, ses bruits, ses odeurs ?\n\nUne maison étroite avec un figuier.',
      tags: ['Enfance'],
      date: '2026-10-18',
      diaryId: 6,
      visibility: 'private',
      format: 'markdown',
    });
    expect(answerRepository.insert).toHaveBeenCalledWith({ userId: 3, questionId: 'childhood-home', entryId: 81 });
    expect(attachmentsService.getOwnedAttachment).toHaveBeenCalledTimes(1);
    expect(attachmentsService.linkMultipleToEntry).toHaveBeenCalledWith(3, [31], 81);
  });

  it('accepts a voice-only answer', async () => {
    configService.getConfig.mockResolvedValue({ language: 'en' });

    await service.answer(3, { questionId: 'love-first', text: '', attachmentIds: [31] });

    expect(entriesService.create).toHaveBeenCalledWith(3, expect.objectContaining({
      text: '### Tell the story of your first love.',
      tags: ['Love and friendship'],
    }));
  });

  it('rejects unknown questions, unstarted programs, missing diaries, and empty answers', async () => {
    await expectApiError(service.answer(3, { questionId: 'missing', text: 'x' }), NotFoundException, 'MEMOIR_UNKNOWN_QUESTION');

    programRepository.findOne.mockResolvedValueOnce(null);
    await expect(service.answer(3, { questionId: 'love-first', text: 'x' })).rejects.toThrow(NotFoundException);

    programRepository.findOne.mockResolvedValueOnce({ userId: 3, diaryId: null, timeZone: 'UTC' });
    await expect(service.answer(3, { questionId: 'love-first', text: 'x' })).rejects.toThrow(ConflictException);

    await expectApiError(service.answer(3, { questionId: 'love-first', text: '' }), BadRequestException, 'MEMOIR_ANSWER_EMPTY');
    expect(entriesService.create).not.toHaveBeenCalled();
  });

  it('refuses a second answer and attachments the writer does not own before writing anything', async () => {
    answerRepository.findOne.mockResolvedValueOnce({ questionId: 'love-first', entryId: 40, entry: { id: 40 } });
    await expect(service.answer(3, { questionId: 'love-first', text: 'x' })).rejects.toThrow(ConflictException);

    attachmentsService.getOwnedAttachment.mockRejectedValueOnce(new NotFoundException('Attachment not found'));
    await expect(service.answer(3, { questionId: 'love-first', text: 'x', attachmentIds: [77] })).rejects.toThrow(
      NotFoundException,
    );
    expect(entriesService.create).not.toHaveBeenCalled();
  });

  it('removes the new entry when a concurrent answer to the same question wins', async () => {
    answerRepository.insert.mockRejectedValueOnce({ code: '23505' });
    await expect(service.answer(3, { questionId: 'love-first', text: 'x', attachmentIds: [31] })).rejects.toThrow(
      ConflictException,
    );
    expect(entriesService.delete).toHaveBeenCalledWith(3, 81);
    expect(attachmentsService.linkMultipleToEntry).not.toHaveBeenCalled();

    answerRepository.insert.mockRejectedValueOnce(new Error('connection lost'));
    await expect(service.answer(3, { questionId: 'love-first', text: 'x' })).rejects.toThrow('connection lost');
    expect(entriesService.delete).toHaveBeenCalledTimes(2);
  });

  it('answers again when the previous answer is in the recycle bin, moving the link to the new entry', async () => {
    answerRepository.findOne.mockResolvedValueOnce({ questionId: 'love-first', entryId: 40, entry: null });

    await expect(service.answer(3, { questionId: 'love-first', text: 'A new telling' })).resolves.toEqual({
      questionId: 'love-first',
      entryId: 81,
    });

    expect(answerRepository.update).toHaveBeenCalledWith({ userId: 3, questionId: 'love-first' }, { entryId: 81 });
    expect(answerRepository.insert).not.toHaveBeenCalled();
  });
});
