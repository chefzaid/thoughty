import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { composePhotoAnswerContent } from './memoir-photo';
import { MemoirPhotoAnswersService } from './memoir-photo-answers.service';

describe('MemoirPhotoAnswersService', () => {
  let programRepository: Record<string, jest.Mock>;
  let photoAnswerRepository: Record<string, jest.Mock>;
  let entriesService: Record<string, jest.Mock>;
  let attachmentsService: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;
  let lifeEras: Record<string, jest.Mock>;
  let service: MemoirPhotoAnswersService;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-19T03:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    programRepository = {
      findOne: jest.fn().mockResolvedValue({ userId: 3, diaryId: 6, timeZone: 'America/Los_Angeles' }),
    };
    photoAnswerRepository = { insert: jest.fn().mockResolvedValue(undefined) };
    entriesService = { create: jest.fn().mockResolvedValue({ success: true, entryId: 81 }) };
    attachmentsService = {
      getOwnedAttachment: jest.fn().mockResolvedValue({ id: 31, mimetype: 'image/jpeg', entryId: null }),
    };
    configService = { getConfig: jest.fn().mockResolvedValue({ language: 'en' }) };
    lifeEras = { findOwn: jest.fn().mockResolvedValue({ id: 4, userId: 3, name: 'Lyon' }) };
    service = new MemoirPhotoAnswersService(
      programRepository as never,
      photoAnswerRepository as never,
      entriesService as never,
      attachmentsService as never,
      configService as never,
      lifeEras as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('saves the photo between the question and the story in a private Markdown entry of the memoir diary, tagged Photos', async () => {
    const result = await service.answer(3, { attachmentId: 31, caption: 'The bakery [1962]', text: 'Grandpa opens his shop.' });

    expect(result).toEqual({ entryId: 81 });
    expect(attachmentsService.getOwnedAttachment).toHaveBeenCalledWith(3, 31);
    expect(entriesService.create).toHaveBeenCalledWith(3, {
      text: '### What is happening here?\n\n![The bakery \\[1962\\]](attachment:31)\n\nGrandpa opens his shop.',
      tags: ['Photos'],
      // The writer's day in the memoir's time zone
      date: '2026-10-18',
      diaryId: 6,
      visibility: 'private',
      format: 'markdown',
    });
    expect(photoAnswerRepository.insert).toHaveBeenCalledWith({ userId: 3, entryId: 81 });
  });

  it('tags the story with the chosen life chapter and era in the writer’s language', async () => {
    configService.getConfig.mockResolvedValue({ language: 'fr' });

    await service.answer(3, { attachmentId: 31, text: 'Le mariage.', chapterId: 'family', eraId: 4 });

    expect(lifeEras.findOwn).toHaveBeenCalledWith(3, 4);
    expect(entriesService.create).toHaveBeenCalledWith(3, expect.objectContaining({
      text: '### Que se passe-t-il ici ?\n\n![](attachment:31)\n\nLe mariage.',
      tags: ['Famille', 'Lyon'],
    }));
  });

  it('keeps one tag when the era is named like the chapter', async () => {
    lifeEras.findOwn.mockResolvedValue({ id: 4, userId: 3, name: 'photos' });

    await service.answer(3, { attachmentId: 31, text: 'A day out.', eraId: 4 });

    expect(entriesService.create).toHaveBeenCalledWith(3, expect.objectContaining({ tags: ['Photos'] }));
  });

  it('refuses without a memoir, without its diary, or without a story', async () => {
    programRepository.findOne.mockResolvedValueOnce(null);
    await expectApiError(service.answer(3, { attachmentId: 31, text: 'x' }), NotFoundException, 'MEMOIR_NOT_STARTED');

    programRepository.findOne.mockResolvedValueOnce({ userId: 3, diaryId: null, timeZone: 'UTC' });
    await expectApiError(service.answer(3, { attachmentId: 31, text: 'x' }), ConflictException, 'MEMOIR_DIARY_REQUIRED');

    await expectApiError(service.answer(3, { attachmentId: 31, text: '' }), BadRequestException, 'MEMOIR_PHOTO_EMPTY');
    expect(entriesService.create).not.toHaveBeenCalled();
  });

  it('refuses a file that is not a picture books can print, and a picture already on an entry', async () => {
    attachmentsService.getOwnedAttachment.mockResolvedValueOnce({ id: 31, mimetype: 'image/svg+xml', entryId: null });
    await expectApiError(service.answer(3, { attachmentId: 31, text: 'x' }), BadRequestException, 'MEMOIR_PHOTO_NOT_IMAGE');

    attachmentsService.getOwnedAttachment.mockResolvedValueOnce({ id: 31, mimetype: 'image/png', entryId: 12 });
    await expectApiError(service.answer(3, { attachmentId: 31, text: 'x' }), ConflictException, 'MEMOIR_PHOTO_IN_USE');

    expect(entriesService.create).not.toHaveBeenCalled();
    expect(photoAnswerRepository.insert).not.toHaveBeenCalled();
  });

  it('lets an unknown attachment or era refuse as its own service does', async () => {
    attachmentsService.getOwnedAttachment.mockRejectedValueOnce(new NotFoundException());
    await expect(service.answer(3, { attachmentId: 99, text: 'x' })).rejects.toBeInstanceOf(NotFoundException);

    lifeEras.findOwn.mockRejectedValueOnce(new NotFoundException());
    await expect(service.answer(3, { attachmentId: 31, text: 'x', eraId: 99 })).rejects.toBeInstanceOf(NotFoundException);
    expect(entriesService.create).not.toHaveBeenCalled();
  });
});

describe('composePhotoAnswerContent', () => {
  it('puts the caption on one line as the photo’s alt text', () => {
    expect(composePhotoAnswerContent('en', 7, 'Two\nlines', 'Story.')).toBe('### What is happening here?\n\n![Two lines](attachment:7)\n\nStory.');
  });
});
