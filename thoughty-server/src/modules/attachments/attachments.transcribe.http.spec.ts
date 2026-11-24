import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createValidatedControllerApp, HTTP_SPEC_USER } from '@/common/validation/validation-http.test-helpers';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { AudioTranscriptionService } from './audio-transcription.service';
import { VideoPosterService } from './video-poster.service';
import { LocalTranscriptService } from './local-transcript.service';
import { TRANSCRIPT_MAX_LENGTH } from './dto';

describe('AttachmentsController transcribe over HTTP', () => {
  let app: INestApplication;
  const audioTranscriptionService = { transcribe: jest.fn() };
  const localTranscriptService = { store: jest.fn() };

  beforeAll(async () => {
    app = await createValidatedControllerApp([AttachmentsController], [
      { provide: AttachmentsService, useValue: {} },
      { provide: AudioTranscriptionService, useValue: audioTranscriptionService },
      { provide: VideoPosterService, useValue: {} },
      { provide: LocalTranscriptService, useValue: localTranscriptService },
    ]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    audioTranscriptionService.transcribe.mockResolvedValue({ transcript: 'Hello', transcribed_at: new Date(), cached: false });
    localTranscriptService.store.mockResolvedValue({ transcript: 'Hello', transcribed_at: new Date(), cached: false });
  });

  afterAll(async () => app.close());

  it('transcribes without a body, as before the diary could be named', async () => {
    await request(app.getHttpServer()).post('/api/attachments/4/transcribe').expect(201);

    expect(audioTranscriptionService.transcribe).toHaveBeenCalledWith(HTTP_SPEC_USER.userId, 4, undefined, undefined);
  });

  it('passes the diary the recording is for', async () => {
    await request(app.getHttpServer()).post('/api/attachments/4/transcribe').send({ diaryId: 3 }).expect(201);

    expect(audioTranscriptionService.transcribe).toHaveBeenCalledWith(HTTP_SPEC_USER.userId, 4, 3, undefined);
  });

  it('passes the writer’s consent for a diary that asks each time', async () => {
    await request(app.getHttpServer()).post('/api/attachments/4/transcribe').send({ diaryId: 3, aiConsent: true }).expect(201);

    expect(audioTranscriptionService.transcribe).toHaveBeenCalledWith(HTTP_SPEC_USER.userId, 4, 3, true);
  });

  it.each(['yes', 2, 'true!'])('refuses aiConsent %j', async (aiConsent) => {
    await request(app.getHttpServer()).post('/api/attachments/4/transcribe').send({ aiConsent }).expect(400);
    expect(audioTranscriptionService.transcribe).not.toHaveBeenCalled();
  });

  it.each(['', 'abc', 1.5, 0, true])('refuses diaryId %j', async (diaryId) => {
    const response = await request(app.getHttpServer())
      .post('/api/attachments/4/transcribe')
      .send({ diaryId })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(audioTranscriptionService.transcribe).not.toHaveBeenCalled();
  });

  describe('PUT /api/attachments/:id/transcript', () => {
    const put = (body: unknown) => request(app.getHttpServer()).put('/api/attachments/4/transcript').send(body as object);

    it('stores the trimmed transcript the browser sends', async () => {
      await put({ transcript: '  Made on my laptop.\n' }).expect(200);

      expect(localTranscriptService.store).toHaveBeenCalledWith(HTTP_SPEC_USER.userId, 4, 'Made on my laptop.');
    });

    it('takes a transcript at the length limit', async () => {
      await put({ transcript: 'a'.repeat(TRANSCRIPT_MAX_LENGTH) }).expect(200);
    });

    it('refuses a transcript over the limit with its own code', async () => {
      const response = await put({ transcript: 'a'.repeat(TRANSCRIPT_MAX_LENGTH + 1) }).expect(400);

      expect(response.body.code).toBe('TRANSCRIPT_TOO_LONG');
      expect(localTranscriptService.store).not.toHaveBeenCalled();
    });

    it.each([{}, { transcript: '' }, { transcript: '   ' }, { transcript: 5 }, { transcript: ['a'] }, { transcript: 'a', model: 'whisper' }])(
      'refuses %j',
      async (body) => {
        const response = await put(body).expect(400);

        expect(response.body.code).toBe('VALIDATION_FAILED');
        expect(localTranscriptService.store).not.toHaveBeenCalled();
      },
    );

    it('refuses an id that is not a number', async () => {
      await request(app.getHttpServer()).put('/api/attachments/abc/transcript').send({ transcript: 'Hi' }).expect(400);
      expect(localTranscriptService.store).not.toHaveBeenCalled();
    });
  });
});
