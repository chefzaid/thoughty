import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createValidatedControllerApp, HTTP_SPEC_USER } from '@/common/validation/validation-http.test-helpers';
import { SavedSearchesController } from './saved-searches.controller';
import { SavedSearchesService } from './saved-searches.service';

describe('SavedSearchesController JSON bodies over HTTP', () => {
  let app: INestApplication;
  const savedSearchesService = { create: jest.fn() };
  const filters = {
    search: '',
    searchMode: 'keyword',
    sort: 'date',
    tags: [],
    date: null,
    visibility: 'all',
    archiveStatus: 'active',
    favorites: false,
    mood: '',
  };

  beforeAll(async () => {
    app = await createValidatedControllerApp([SavedSearchesController], [{ provide: SavedSearchesService, useValue: savedSearchesService }]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    savedSearchesService.create.mockResolvedValue({ id: 1 });
  });

  afterAll(async () => app.close());

  it('saves a search for one diary, for all diaries, and reads digits as the diary', async () => {
    await request(app.getHttpServer()).post('/api/saved-searches').send({ name: 'Walks', diaryId: 2, filters }).expect(201);
    await request(app.getHttpServer()).post('/api/saved-searches').send({ name: 'Walks', diaryId: null, filters }).expect(201);
    await request(app.getHttpServer()).post('/api/saved-searches').send({ name: 'Walks', diaryId: '4', filters: { ...filters, eraId: '3' } }).expect(201);

    const calls = savedSearchesService.create.mock.calls.map(([userId, dto]) => [userId, dto.diaryId, dto.filters.eraId]);
    expect(calls).toEqual([
      [HTTP_SPEC_USER.userId, 2, undefined],
      [HTTP_SPEC_USER.userId, null, undefined],
      [HTTP_SPEC_USER.userId, 4, 3],
    ]);
  });

  it.each([
    { diaryId: '' },
    { diaryId: true },
    { diaryId: 0 },
    { name: 12 },
    { filters: { ...filters, personId: '' } },
    { filters: { ...filters, favorites: 'yes' } },
  ])('refuses %j with VALIDATION_FAILED', async (change) => {
    const response = await request(app.getHttpServer())
      .post('/api/saved-searches')
      .send({ name: 'Walks', diaryId: null, filters, ...change })
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(savedSearchesService.create).not.toHaveBeenCalled();
  });
});
