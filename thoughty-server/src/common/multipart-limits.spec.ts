import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AttachmentsController } from '@/modules/attachments/attachments.controller';
import { AttachmentsService } from '@/modules/attachments/attachments.service';
import { AudioTranscriptionService } from '@/modules/attachments/audio-transcription.service';
import { BooksController } from '@/modules/books/books.controller';
import { BooksService } from '@/modules/books/books.service';
import { BookVersionsService } from '@/modules/books/book-versions.service';
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
        { provide: BooksService, useValue: { export: exportBook } },
        { provide: BookVersionsService, useValue: { create: createVersion } },
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

  it('keeps the attachment file-size limit', async () => {
    await request(app.getHttpServer())
      .post('/attachments/upload')
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), 'large.txt')
      .expect(413);
    expect(upload).not.toHaveBeenCalled();
  });
});
