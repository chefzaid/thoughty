import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createValidatedControllerApp, HTTP_SPEC_USER } from '@/common/validation/validation-http.test-helpers';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { AudioTranscriptionService } from './audio-transcription.service';

describe('AttachmentsController form fields over HTTP', () => {
  let app: INestApplication;
  const attachment = {
    id: 9,
    originalFilename: 'photo.png',
    mimeType: 'image/png',
    size: 4,
    entryId: 12,
    createdAt: new Date('2026-10-27T10:00:00Z'),
  };
  const attachmentsService = { upload: jest.fn() };

  beforeAll(async () => {
    app = await createValidatedControllerApp([AttachmentsController], [
      { provide: AttachmentsService, useValue: attachmentsService },
      { provide: AudioTranscriptionService, useValue: {} },
    ]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    attachmentsService.upload.mockResolvedValue(attachment);
  });

  afterAll(async () => app.close());

  it('reads the entryId form field as a number', async () => {
    await request(app.getHttpServer())
      .post('/api/attachments/upload')
      .field('entryId', '12')
      .attach('file', Buffer.from('png!'), { filename: 'photo.png', contentType: 'image/png' })
      .expect(201);

    expect(attachmentsService.upload).toHaveBeenCalledWith(HTTP_SPEC_USER.userId, expect.objectContaining({ originalname: 'photo.png' }), 12);
  });

  it('uploads without an entry when the field is left out', async () => {
    await request(app.getHttpServer())
      .post('/api/attachments/upload')
      .attach('file', Buffer.from('png!'), { filename: 'photo.png', contentType: 'image/png' })
      .expect(201);

    expect(attachmentsService.upload).toHaveBeenCalledWith(HTTP_SPEC_USER.userId, expect.anything(), undefined);
  });

  it.each(['', 'abc', '1.5'])('refuses entryId %j instead of reading it as 0 or NaN', async (entryId) => {
    const response = await request(app.getHttpServer())
      .post('/api/attachments/upload')
      .field('entryId', entryId)
      .attach('file', Buffer.from('png!'), { filename: 'photo.png', contentType: 'image/png' })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(attachmentsService.upload).not.toHaveBeenCalled();
  });
});
