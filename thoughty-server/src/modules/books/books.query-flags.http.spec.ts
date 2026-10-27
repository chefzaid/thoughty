import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createValidatedControllerApp, HTTP_SPEC_USER } from '@/common/validation/validation-http.test-helpers';
import { CloudSyncService } from '@/modules/cloud-sync';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { BookVersionsService } from './book-versions.service';
import { BookEntrySourceService } from './book-entry-source.service';

const OFF = 'narrative=false&includeToc=false&includeDates=false&includeUntagged=false&chapterFraming=false&embedImages=false';
const ALL_OFF = {
  narrative: false,
  includeToc: false,
  includeDates: false,
  includeUntagged: false,
  chapterFraming: false,
  embedImages: false,
};
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a5d00000000049454e44ae426082', 'hex');

describe('BooksController query flags over HTTP', () => {
  let app: INestApplication;
  const bookFile = { content: Buffer.from('# Book'), contentType: 'text/markdown', filename: 'book.md' };
  const booksService = { export: jest.fn(), preview: jest.fn() };
  const bookVersionsService = { create: jest.fn(), list: jest.fn() };
  const cloudSyncService = { uploadFile: jest.fn() };

  beforeAll(async () => {
    app = await createValidatedControllerApp([BooksController], [
      { provide: BooksService, useValue: booksService },
      { provide: BookVersionsService, useValue: bookVersionsService },
      { provide: BookEntrySourceService, useValue: {} },
      { provide: CloudSyncService, useValue: cloudSyncService },
    ]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    booksService.export.mockResolvedValue(bookFile);
    booksService.preview.mockResolvedValue({ title: 'Book', chapterCount: 0, entryCount: 0, chapters: [] });
    bookVersionsService.create.mockResolvedValue({ id: 1 });
    bookVersionsService.list.mockResolvedValue([]);
    cloudSyncService.uploadFile.mockResolvedValue({ id: 'f1' });
  });

  afterAll(async () => app.close());

  it('downloads a book with every option turned off as false, not true', async () => {
    await request(app.getHttpServer()).get(`/api/books/export?format=md&${OFF}`).expect(200);

    expect(booksService.export).toHaveBeenCalledWith(HTTP_SPEC_USER.userId, expect.objectContaining({ format: 'md', ...ALL_OFF }));
  });

  it('reads true and 1 as on', async () => {
    await request(app.getHttpServer()).get('/api/books/export?narrative=true&chapterFraming=1').expect(200);

    expect(booksService.export).toHaveBeenCalledWith(HTTP_SPEC_USER.userId, expect.objectContaining({ narrative: true, chapterFraming: true }));
  });

  it('leaves options it is not sent unset, for the service defaults', async () => {
    await request(app.getHttpServer()).get('/api/books/export').expect(200);

    const query = booksService.export.mock.calls[0][1];
    expect(Object.keys(ALL_OFF).filter((key) => query[key] !== undefined)).toEqual([]);
  });

  it('keeps the options false for the outline preview', async () => {
    await request(app.getHttpServer()).get(`/api/books/preview?${OFF}`).expect(200);

    expect(booksService.preview).toHaveBeenCalledWith(HTTP_SPEC_USER.userId, expect.objectContaining(ALL_OFF));
  });

  it('keeps the options false for a download with a custom cover sent as a form', async () => {
    await request(app.getHttpServer())
      .post(`/api/books/export?format=epub&${OFF}`)
      .attach('coverImage', PNG, { filename: 'cover.png', contentType: 'image/png' })
      .expect(200);

    expect(booksService.export).toHaveBeenCalledWith(
      HTTP_SPEC_USER.userId,
      expect.objectContaining({ format: 'epub', ...ALL_OFF }),
      expect.objectContaining({ originalname: 'cover.png' }),
    );
  });

  it('keeps the options false for a saved version and a cloud upload', async () => {
    await request(app.getHttpServer()).post(`/api/books/versions?diaryId=3&${OFF}`).expect(201);
    await request(app.getHttpServer()).post(`/api/books/upload?provider=dropbox&${OFF}`).expect(201);

    expect(bookVersionsService.create).toHaveBeenCalledWith(HTTP_SPEC_USER.userId, expect.objectContaining({ diaryId: 3, ...ALL_OFF }), undefined);
    expect(booksService.export).toHaveBeenCalledWith(HTTP_SPEC_USER.userId, expect.objectContaining(ALL_OFF), undefined);
    expect(booksService.export.mock.calls[0][1]).not.toHaveProperty('provider');
  });

  it.each(['narrative=yes', 'includeToc=', 'narrative=true&narrative=false', 'diaryId=', 'diaryId=1.5', 'savedSearchId=0'])(
    'refuses %s with VALIDATION_FAILED',
    async (query) => {
      const response = await request(app.getHttpServer()).get(`/api/books/export?${query}`).expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
      expect(booksService.export).not.toHaveBeenCalled();
    },
  );

  it('reads the history diary as a number', async () => {
    await request(app.getHttpServer()).get('/api/books/versions?diaryId=4').expect(200);

    expect(bookVersionsService.list).toHaveBeenCalledWith(HTTP_SPEC_USER.userId, { diaryId: 4 });
  });
});
