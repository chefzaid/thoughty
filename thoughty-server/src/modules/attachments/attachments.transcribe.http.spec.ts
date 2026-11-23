import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createValidatedControllerApp, HTTP_SPEC_USER } from '@/common/validation/validation-http.test-helpers';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { AudioTranscriptionService } from './audio-transcription.service';
import { VideoPosterService } from './video-poster.service';

describe('AttachmentsController transcribe over HTTP', () => {
  let app: INestApplication;
  const audioTranscriptionService = { transcribe: jest.fn() };

  beforeAll(async () => {
    app = await createValidatedControllerApp([AttachmentsController], [
      { provide: AttachmentsService, useValue: {} },
      { provide: AudioTranscriptionService, useValue: audioTranscriptionService },
      { provide: VideoPosterService, useValue: {} },
    ]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    audioTranscriptionService.transcribe.mockResolvedValue({ transcript: 'Hello', transcribed_at: new Date(), cached: false });
  });

  afterAll(async () => app.close());

  it('transcribes without a body, as before the diary could be named', async () => {
    await request(app.getHttpServer()).post('/api/attachments/4/transcribe').expect(201);

    expect(audioTranscriptionService.transcribe).toHaveBeenCalledWith(HTTP_SPEC_USER.userId, 4, undefined);
  });

  it('passes the diary the recording is for', async () => {
    await request(app.getHttpServer()).post('/api/attachments/4/transcribe').send({ diaryId: 3 }).expect(201);

    expect(audioTranscriptionService.transcribe).toHaveBeenCalledWith(HTTP_SPEC_USER.userId, 4, 3);
  });

  it.each(['', 'abc', 1.5, 0, true])('refuses diaryId %j', async (diaryId) => {
    const response = await request(app.getHttpServer())
      .post('/api/attachments/4/transcribe')
      .send({ diaryId })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(audioTranscriptionService.transcribe).not.toHaveBeenCalled();
  });
});
