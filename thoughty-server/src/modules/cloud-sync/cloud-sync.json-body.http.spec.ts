import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createValidatedControllerApp, HTTP_SPEC_USER } from '@/common/validation/validation-http.test-helpers';
import { CloudSyncController } from './cloud-sync.controller';
import { CloudSyncService } from './cloud-sync.service';

describe('CloudSyncController JSON bodies over HTTP', () => {
  let app: INestApplication;
  const cloudSyncService = { uploadExport: jest.fn() };

  beforeAll(async () => {
    app = await createValidatedControllerApp([CloudSyncController], [{ provide: CloudSyncService, useValue: cloudSyncService }]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    cloudSyncService.uploadExport.mockResolvedValue({ id: 'f1', name: 'journal.txt' });
  });

  afterAll(async () => app.close());

  it('uploads one diary, read from a number or digits, or every diary when it is left out', async () => {
    await request(app.getHttpServer()).post('/api/cloud-sync/upload').send({ provider: 'dropbox', diaryId: 3 }).expect(201);
    await request(app.getHttpServer()).post('/api/cloud-sync/upload').send({ provider: 'dropbox', diaryId: '4' }).expect(201);
    await request(app.getHttpServer()).post('/api/cloud-sync/upload').send({ provider: 'dropbox' }).expect(201);

    expect(cloudSyncService.uploadExport.mock.calls.map((call) => call.slice(0, 3))).toEqual([
      [HTTP_SPEC_USER.userId, 'dropbox', 3],
      [HTTP_SPEC_USER.userId, 'dropbox', 4],
      [HTTP_SPEC_USER.userId, 'dropbox', undefined],
    ]);
  });

  it.each(['', '3abc', '1.5', 1.5])('refuses the diary %j, which it once read as a truncated number', async (diaryId) => {
    const response = await request(app.getHttpServer()).post('/api/cloud-sync/upload').send({ provider: 'dropbox', diaryId }).expect(400);

    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(cloudSyncService.uploadExport).not.toHaveBeenCalled();
  });
});
