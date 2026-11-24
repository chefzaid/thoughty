import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { LocalTranscriptService } from './local-transcript.service';

describe('LocalTranscriptService', () => {
  const localEntry = { id: 10, diaryAiOff: true, diaryAiAsk: false, diaryAiLocal: true };
  const recording = (overrides: Record<string, unknown> = {}) => ({
    id: 4,
    userId: 7,
    mimetype: 'audio/webm',
    transcript: null,
    transcribedAt: null,
    entry: localEntry,
    ...overrides,
  });
  const attachmentsService = { getOwnedAttachment: jest.fn(), save: jest.fn() };
  let service: LocalTranscriptService;

  beforeEach(() => {
    jest.clearAllMocks();
    attachmentsService.save.mockImplementation(async (value) => value);
    service = new LocalTranscriptService(attachmentsService as never);
  });

  it('keeps the text on the recording of an entry in a diary on the writer’s own model', async () => {
    attachmentsService.getOwnedAttachment.mockResolvedValue(recording());

    const result = await service.store(7, 4, 'Made on my laptop');

    expect(attachmentsService.getOwnedAttachment).toHaveBeenCalledWith(7, 4);
    expect(attachmentsService.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4, transcript: 'Made on my laptop', transcribedAt: expect.any(Date) }),
    );
    expect(result).toEqual({ transcript: 'Made on my laptop', transcribed_at: expect.any(Date), cached: false });
  });

  it('replaces an earlier transcript', async () => {
    attachmentsService.getOwnedAttachment.mockResolvedValue(recording({ transcript: 'Old', transcribedAt: new Date('2026-01-01') }));

    await expect(service.store(7, 4, 'New')).resolves.toMatchObject({ transcript: 'New' });
  });

  it('refuses a file that is not a recording', async () => {
    attachmentsService.getOwnedAttachment.mockResolvedValue(recording({ mimetype: 'image/png' }));

    await expectApiError(service.store(7, 4, 'Text'), BadRequestException, 'ATTACHMENT_NOT_AUDIO');
    expect(attachmentsService.save).not.toHaveBeenCalled();
  });

  it.each([
    ['AI on', { ...localEntry, diaryAiOff: false, diaryAiLocal: false }],
    ['AI off', { ...localEntry, diaryAiLocal: false }],
    ['ask each time', { ...localEntry, diaryAiOff: false, diaryAiAsk: true, diaryAiLocal: false }],
    ['no entry yet', null],
  ])('refuses a recording of a diary with %s', async (_mode, entry) => {
    attachmentsService.getOwnedAttachment.mockResolvedValue(recording({ entry }));

    await expectApiError(service.store(7, 4, 'Text'), ForbiddenException, 'TRANSCRIPT_LOCAL_DIARY_ONLY');
    expect(attachmentsService.save).not.toHaveBeenCalled();
  });

  it('passes on the refusal of a recording that is not the writer’s', async () => {
    attachmentsService.getOwnedAttachment.mockRejectedValue(apiError(NotFoundException, 'ATTACHMENT_NOT_FOUND'));

    await expectApiError(service.store(8, 4, 'Text'), NotFoundException, 'ATTACHMENT_NOT_FOUND');
    expect(attachmentsService.save).not.toHaveBeenCalled();
  });
});
