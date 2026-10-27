import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createValidatedControllerApp, HTTP_SPEC_USER } from '@/common/validation/validation-http.test-helpers';
import { EntriesController } from './entries.controller';
import { EntriesService } from './entries.service';

describe('EntriesController query flags over HTTP', () => {
  let app: INestApplication;
  const entriesService = {
    getEntries: jest.fn(),
    getCalendarMonth: jest.fn(),
    getFirstEntry: jest.fn(),
  };

  beforeAll(async () => {
    app = await createValidatedControllerApp([EntriesController], [{ provide: EntriesService, useValue: entriesService }]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    entriesService.getEntries.mockResolvedValue({ entries: [], total: 0 });
    entriesService.getCalendarMonth.mockResolvedValue({ month: '2026-10', entries: [] });
    entriesService.getFirstEntry.mockResolvedValue({ page: 1 });
  });

  afterAll(async () => app.close());

  it('lists every entry for favorites=false, and only favorites for favorites=true', async () => {
    await request(app.getHttpServer()).get('/api/entries?favorites=false').expect(200);
    await request(app.getHttpServer()).get('/api/entries?favorites=true').expect(200);

    expect(entriesService.getEntries).toHaveBeenNthCalledWith(1, HTTP_SPEC_USER.userId, expect.objectContaining({ favorites: false }));
    expect(entriesService.getEntries).toHaveBeenNthCalledWith(2, HTTP_SPEC_USER.userId, expect.objectContaining({ favorites: true }));
  });

  it('keeps favorites=0 false for the calendar month', async () => {
    await request(app.getHttpServer()).get('/api/entries/calendar?month=2026-10&favorites=0&diaryId=2').expect(200);

    expect(entriesService.getCalendarMonth).toHaveBeenCalledWith(
      HTTP_SPEC_USER.userId,
      expect.objectContaining({ month: '2026-10', favorites: false, diaryId: 2 }),
    );
  });

  it('reads paging as whole numbers and keeps the defaults when it is left out', async () => {
    await request(app.getHttpServer()).get('/api/entries?page=3&limit=25').expect(200);
    await request(app.getHttpServer()).get('/api/entries').expect(200);

    expect(entriesService.getEntries).toHaveBeenNthCalledWith(1, HTTP_SPEC_USER.userId, expect.objectContaining({ page: 3, limit: 25 }));
    expect(entriesService.getEntries).toHaveBeenNthCalledWith(2, HTTP_SPEC_USER.userId, expect.objectContaining({ page: 1, limit: 10 }));
  });

  it.each(['favorites=yes', 'favorites=', 'diaryId=', 'diaryId=abc', 'page=0', 'eraId=1.5', 'personId=2&personId=3'])(
    'refuses %s with VALIDATION_FAILED',
    async (query) => {
      const response = await request(app.getHttpServer()).get(`/api/entries?${query}`).expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
      expect(entriesService.getEntries).not.toHaveBeenCalled();
    },
  );

  it('reads the year and month of the first-entry lookup as numbers', async () => {
    await request(app.getHttpServer()).get('/api/entries/first?year=2024&month=0').expect(200);

    expect(entriesService.getFirstEntry).toHaveBeenCalledWith(HTTP_SPEC_USER.userId, { year: 2024, month: 0, limit: 10 });
  });
});
