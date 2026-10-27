import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AttachmentsController } from '@/modules/attachments/attachments.controller';
import { AttachmentsService } from '@/modules/attachments/attachments.service';
import { existsSync } from 'node:fs';
import { AudioTranscriptionService } from '@/modules/attachments/audio-transcription.service';
import { VideoPosterService } from '@/modules/attachments/video-poster.service';
import { BooksController } from '@/modules/books/books.controller';
import { BooksService } from '@/modules/books/books.service';
import { BookVersionsService } from '@/modules/books/book-versions.service';
import { BookEntrySourceService } from '@/modules/books/book-entry-source.service';
import { CloudSyncService } from '@/modules/cloud-sync';
import { JwtAuthGuard } from '@/modules/auth/guards';

describe('Multipart upload limits', () => {
  let app: INestApplication;
  const upload = jest.fn().mockResolvedValue({ id: 1 });
  const exportBook = jest.fn();
  const createVersion = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AttachmentsController, BooksController],
      providers: [
        { provide: AttachmentsService, useValue: { upload } },
        { provide: AudioTranscriptionService, useValue: {} },
        { provide: VideoPosterService, useValue: {} },
        { provide: BooksService, useValue: { export: exportBook } },
        { provide: BookVersionsService, useValue: { create: createVersion } },
        { provide: BookEntrySourceService, useValue: {} },
        { provide: CloudSyncService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user: unknown } } }) => {
          context.switchToHttp().getRequest().user = { userId: 7 };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => app.close());

  it('accepts an attachment with its scalar entry ID through the real interceptor', async () => {
    await request(app.getHttpServer())
      .post('/attachments/upload')
      .field('entryId', '123')
      .attach('file', Buffer.from('journal fixture'), 'note.txt')
      .expect(201);
    expect(upload).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ originalname: 'note.txt', size: 15 }),
      '123',
    );
  });

  it.each(['/attachments/upload', '/books/versions', '/books/export', '/books/upload'])(
    'rejects sparse-array field names before application code at %s',
    async (path) => {
      await request(app.getHttpServer())
        .post(path)
        .field('items[4294967294]', 'fixture')
        .expect(400);
      expect(upload).not.toHaveBeenCalled();
      expect(exportBook).not.toHaveBeenCalled();
      expect(createVersion).not.toHaveBeenCalled();
    },
  );

  it('writes the upload to a temporary file and deletes it once answered, whatever the outcome', async () => {
    const paths: string[] = [];
    upload.mockImplementationOnce((_user: number, file: Express.Multer.File) => {
      paths.push(file.path);
      expect(existsSync(file.path)).toBe(true);
      return Promise.reject(new Error('storage down'));
    });
    await request(app.getHttpServer())
      .post('/attachments/upload')
      .attach('file', Buffer.from('journal fixture'), 'note.txt')
      .expect(500);
    expect(paths).toHaveLength(1);
    await new Promise((resolve) => setImmediate(resolve));
    expect(existsSync(paths[0]!)).toBe(false);
  });

  it('stops an upload at the 50 MB video limit before the application sees it', async () => {
    await request(app.getHttpServer())
      .post('/attachments/upload')
      .attach('file', Buffer.alloc(50 * 1024 * 1024 + 1), { filename: 'long.mp4', contentType: 'video/mp4' })
      .expect(413);
    expect(upload).not.toHaveBeenCalled();
  });
});
