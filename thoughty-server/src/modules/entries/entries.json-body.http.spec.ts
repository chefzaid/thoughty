import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createValidatedControllerApp, HTTP_SPEC_USER } from '@/common/validation/validation-http.test-helpers';
import { EntriesController } from './entries.controller';
import { EntriesService } from './entries.service';

describe('EntriesController JSON bodies over HTTP', () => {
  let app: INestApplication;
  const entriesService = {
    create: jest.fn(),
    bulkOperation: jest.fn(),
    reorderEntries: jest.fn(),
    setTask: jest.fn(),
  };
  const entry = { text: 'A walk by the river', tags: ['walk'], date: '2026-10-27' };

  beforeAll(async () => {
    app = await createValidatedControllerApp([EntriesController], [{ provide: EntriesService, useValue: entriesService }]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    entriesService.create.mockResolvedValue({ success: true });
    entriesService.bulkOperation.mockResolvedValue({ success: true, affectedCount: 1 });
    entriesService.reorderEntries.mockResolvedValue({ success: true });
    entriesService.setTask.mockResolvedValue({ success: true });
  });

  afterAll(async () => app.close());

  it('takes the diary of a new entry as a number, or as digits', async () => {
    await request(app.getHttpServer()).post('/api/entries').send({ ...entry, diaryId: 2 }).expect(201);
    await request(app.getHttpServer()).post('/api/entries').send({ ...entry, diaryId: '3' }).expect(201);

    expect(entriesService.create).toHaveBeenNthCalledWith(1, HTTP_SPEC_USER.userId, expect.objectContaining({ diaryId: 2 }));
    expect(entriesService.create).toHaveBeenNthCalledWith(2, HTTP_SPEC_USER.userId, expect.objectContaining({ diaryId: 3 }));
  });

  it.each([
    ['an empty diary', { diaryId: '' }],
    ['a fractional diary', { diaryId: 1.5 }],
    ['a diary given as true', { diaryId: true }],
    ['a mood written as text', { mood: '4.5' }],
    ['a text that is an object', { text: { body: 'A walk' } }],
    ['a text that is a number', { text: 42 }],
    ['a tag that is a number', { tags: [7] }],
  ])('refuses %s with VALIDATION_FAILED before the service sees it', async (_case, change) => {
    const response = await request(app.getHttpServer()).post('/api/entries').send({ ...entry, ...change }).expect(400);

    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(entriesService.create).not.toHaveBeenCalled();
  });

  it('reads the entry IDs and target diary of a bulk move', async () => {
    await request(app.getHttpServer()).post('/api/entries/bulk').send({ ids: [4, '5'], action: 'move', diaryId: '2' }).expect(200);

    expect(entriesService.bulkOperation).toHaveBeenCalledWith(HTTP_SPEC_USER.userId, expect.objectContaining({ ids: [4, 5], diaryId: 2 }));
  });

  it.each([{ ids: [''] }, { ids: [true] }, { ids: [1], diaryId: '' }])('refuses the bulk operation %j', async (change) => {
    await request(app.getHttpServer()).post('/api/entries/bulk').send({ action: 'move', ...change }).expect(400);

    expect(entriesService.bulkOperation).not.toHaveBeenCalled();
  });

  it('refuses an empty entry ID in a reorder and an empty task line', async () => {
    await request(app.getHttpServer()).patch('/api/entries/reorder').send({ date: '2026-10-27', orderedIds: [2, ''] }).expect(400);
    await request(app.getHttpServer()).patch('/api/entries/9/tasks').send({ line: '', checked: true }).expect(400);

    expect(entriesService.reorderEntries).not.toHaveBeenCalled();
    expect(entriesService.setTask).not.toHaveBeenCalled();
  });

  it('reads a task line of 0 and its state', async () => {
    await request(app.getHttpServer()).patch('/api/entries/9/tasks').send({ line: 0, checked: 'false' }).expect(200);

    expect(entriesService.setTask).toHaveBeenCalledWith(HTTP_SPEC_USER.userId, 9, { line: 0, checked: false });
  });
});
