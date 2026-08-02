import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { AudioTranscriptionService } from './audio-transcription.service';

describe('AudioTranscriptionService', () => {
  const attachment = {
    id: 4,
    userId: 7,
    storedFilename: 'voice-note.mp3',
    mimetype: 'audio/mpeg',
    transcript: null,
    transcribedAt: null,
  };
  const attachmentsService = {
    getOwnedAttachment: jest.fn(),
    getFileBuffer: jest.fn(),
    save: jest.fn(),
  };
  const configService = { getDecryptedConfig: jest.fn() };
  const usageService = { recordResponse: jest.fn() };
  let service: AudioTranscriptionService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENROUTER_API_KEY;
    attachmentsService.getOwnedAttachment.mockResolvedValue({ ...attachment });
    attachmentsService.getFileBuffer.mockResolvedValue(Buffer.from('audio'));
    attachmentsService.save.mockImplementation(async (value) => value);
    configService.getDecryptedConfig.mockResolvedValue('sk-or-v1-personal');
    service = new AudioTranscriptionService(
      attachmentsService as never,
      configService as never,
      usageService as never,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('transcribes owned audio, records usage, and caches the text', async () => {
    const payload = {
      text: ' A useful voice note. ',
      usage: { input_tokens: 12, output_tokens: 5, total_tokens: 17, cost: 0.001 },
    };
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(payload),
    } as never);

    const result = await service.transcribe(7, 4);

    expect(attachmentsService.getOwnedAttachment).toHaveBeenCalledWith(7, 4);
    expect(attachmentsService.getFileBuffer).toHaveBeenCalledWith(
      'voice-note.mp3',
      5 * 1024 * 1024,
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/audio/transcriptions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-or-v1-personal' }),
      }),
    );
    const request = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toEqual({
      model: 'openai/whisper-large-v3',
      input_audio: { data: Buffer.from('audio').toString('base64'), format: 'mp3' },
    });
    expect(usageService.recordResponse).toHaveBeenCalledWith(
      7,
      'personal',
      'openai/whisper-large-v3',
      payload,
    );
    expect(attachmentsService.save).toHaveBeenCalledWith(
      expect.objectContaining({
        transcript: 'A useful voice note.',
        transcribedAt: expect.any(Date),
      }),
    );
    expect(result).toEqual({
      transcript: 'A useful voice note.',
      transcribed_at: expect.any(Date),
      cached: false,
    });
  });

  it('returns a cached transcript without reading audio or spending usage', async () => {
    const transcribedAt = new Date('2026-08-01T12:00:00Z');
    attachmentsService.getOwnedAttachment.mockResolvedValue({
      ...attachment,
      transcript: 'Already done',
      transcribedAt,
    });

    await expect(service.transcribe(7, 4)).resolves.toEqual({
      transcript: 'Already done',
      transcribed_at: transcribedAt,
      cached: true,
    });
    expect(attachmentsService.getFileBuffer).not.toHaveBeenCalled();
    expect(usageService.recordResponse).not.toHaveBeenCalled();
  });

  it('rejects non-audio attachments before resolving credentials', async () => {
    attachmentsService.getOwnedAttachment.mockResolvedValue({
      ...attachment,
      mimetype: 'application/pdf',
    });

    await expect(service.transcribe(7, 4)).rejects.toThrow(BadRequestException);
    expect(configService.getDecryptedConfig).not.toHaveBeenCalled();
  });

  it('requires an OpenRouter credential', async () => {
    configService.getDecryptedConfig.mockResolvedValue('');

    await expect(service.transcribe(7, 4)).rejects.toThrow(BadRequestException);
    expect(attachmentsService.getFileBuffer).not.toHaveBeenCalled();
  });

  it('does not cache empty or failed provider responses', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ text: '   ' }),
    } as never);

    await expect(service.transcribe(7, 4)).rejects.toThrow(BadGatewayException);
    expect(attachmentsService.save).not.toHaveBeenCalled();
  });

  it('normalizes provider errors without persisting transcript data', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as never);

    await expect(service.transcribe(7, 4)).rejects.toThrow(BadGatewayException);
    expect(usageService.recordResponse).not.toHaveBeenCalled();
    expect(attachmentsService.save).not.toHaveBeenCalled();
  });

  it('normalizes network errors without exposing credential details', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Bearer secret leaked upstream'));

    await expect(service.transcribe(7, 4)).rejects.toThrow(
      'Audio transcription provider is unavailable',
    );
  });
});
