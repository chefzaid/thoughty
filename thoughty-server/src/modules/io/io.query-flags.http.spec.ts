import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createValidatedControllerApp, HTTP_SPEC_USER } from '@/common/validation/validation-http.test-helpers';
import { IoController } from './io.controller';
import { IoService } from './io.service';
import { AppImportService } from './app-import.service';
import { MarkdownArchiveService } from './markdown-archive.service';

describe('IoController query flags over HTTP', () => {
  let app: INestApplication;
  const ioService = { export: jest.fn() };

  beforeAll(async () => {
    app = await createValidatedControllerApp([IoController], [
      { provide: IoService, useValue: ioService },
      { provide: AppImportService, useValue: {} },
      { provide: MarkdownArchiveService, useValue: {} },
    ]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    ioService.export.mockResolvedValue({ content: '[]', filename: 'export.json', contentType: 'application/json' });
  });

  afterAll(async () => app.close());

  it('exports without visibility for includeVisibility=false', async () => {
    await request(app.getHttpServer()).get('/api/io/export?format=json&includeVisibility=false&diaryId=5').expect(200);

    expect(ioService.export).toHaveBeenCalledWith(HTTP_SPEC_USER.userId, 5, false, 'json');
  });

  it('exports with visibility for includeVisibility=true, and leaves it unset when not sent', async () => {
    await request(app.getHttpServer()).get('/api/io/export?includeVisibility=true').expect(200);
    await request(app.getHttpServer()).get('/api/io/export').expect(200);

    expect(ioService.export).toHaveBeenNthCalledWith(1, HTTP_SPEC_USER.userId, undefined, true, undefined);
    expect(ioService.export).toHaveBeenNthCalledWith(2, HTTP_SPEC_USER.userId, undefined, undefined, undefined);
  });

  it.each(['includeVisibility=on', 'diaryId=', 'diaryId=0x5'])('refuses %s with VALIDATION_FAILED', async (query) => {
    const response = await request(app.getHttpServer()).get(`/api/io/export?${query}`).expect(400);

    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(ioService.export).not.toHaveBeenCalled();
  });
});
