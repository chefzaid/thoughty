import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Attachment, Diary, Entry } from '@/database/entities';
import { AttachmentsService } from '@/modules/attachments';
import { DiariesService } from '@/modules/diaries';
import { EntryMentionsService } from '@/modules/entries/entry-mentions.service';
import { AppImportService } from './app-import.service';
import type { AppImportDto, AppImportEntryDto } from './dto';

describe('AppImportService', () => {
  let service: AppImportService;
  let entryRepository: {
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    count: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let diaryRepository: { findOne: jest.Mock; find: jest.Mock };
  let attachmentRepository: { find: jest.Mock };
  let diariesService: { create: jest.Mock };
  let attachmentsService: { assertUploadable: jest.Mock; upload: jest.Mock };
  let dayCounts: Array<{ date: string; count: string }>;
  let nextId: number;

  const entry = (overrides: Partial<AppImportEntryDto> = {}): AppImportEntryDto => ({
    sourceId: 'A1',
    date: '2024-03-05',
    content: 'A long day by the sea.',
    tags: [],
    ...overrides,
  });
  const batch = (entries: AppImportEntryDto[], overrides: Partial<AppImportDto> = {}): AppImportDto => ({
    source: 'dayone',
    entries,
    ...overrides,
  });

  beforeEach(async () => {
    nextId = 100;
    dayCounts = [];
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(async () => dayCounts),
    };
    entryRepository = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((row) => row),
      save: jest.fn(async (rows: Array<Record<string, unknown>>) => rows.map((row) => ({ ...row, id: nextId++ }))),
      count: jest.fn(),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    diaryRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 1, userId: 7, isDefault: true }),
      find: jest.fn().mockResolvedValue([]),
    };
    attachmentRepository = { find: jest.fn().mockResolvedValue([]) };
    diariesService = { create: jest.fn() };
    attachmentsService = { assertUploadable: jest.fn(), upload: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AppImportService,
        { provide: getRepositoryToken(Entry), useValue: entryRepository },
        { provide: getRepositoryToken(Diary), useValue: diaryRepository },
        { provide: getRepositoryToken(Attachment), useValue: attachmentRepository },
        { provide: DiariesService, useValue: diariesService },
        { provide: AttachmentsService, useValue: attachmentsService },
        { provide: EntryMentionsService, useValue: { save: (_userId: number, value: unknown) => entryRepository.save(value) } },
      ],
    }).compile();
    service = moduleRef.get(AppImportService);
  });

  describe('importEntries', () => {
    it('adds private Markdown entries to the default diary, numbered after the entries already on that day', async () => {
      dayCounts = [{ date: '2024-03-05', count: '2' }];

      const result = await service.importEntries(
        7,
        batch([
          entry({ sourceId: 'A1', tags: [' travel ', 'travel', '<b>sea</b>', ''], favorite: true }),
          entry({ sourceId: 'A2', content: 'Evening swim.' }),
          entry({ sourceId: 'A3', date: '2024-03-06', content: '' }),
        ]),
      );

      expect(diaryRepository.findOne).toHaveBeenCalledWith({ where: { userId: 7, isDefault: true } });
      const [rows] = entryRepository.save.mock.calls[0];
      expect(rows).toEqual([
        expect.objectContaining({ userId: 7, diaryId: 1, date: '2024-03-05', index: 3, tags: ['travel', 'sea'], format: 'markdown', visibility: 'private', isFavorite: true, importRef: 'dayone:A1' }),
        expect.objectContaining({ date: '2024-03-05', index: 4, isFavorite: false, importRef: 'dayone:A2' }),
        expect.objectContaining({ date: '2024-03-06', index: 1, content: '', importRef: 'dayone:A3' }),
      ]);
      expect(result).toEqual({
        entries: [
          { sourceId: 'A1', entryId: 100, alreadyImported: false, attachedFiles: [] },
          { sourceId: 'A2', entryId: 101, alreadyImported: false, attachedFiles: [] },
          { sourceId: 'A3', entryId: 102, alreadyImported: false, attachedFiles: [] },
        ],
        importedCount: 3,
        alreadyImportedCount: 0,
        createdDiaries: [],
      });
    });

    it('keeps the title and time of day the source app gave each entry', async () => {
      await service.importEntries(7, batch([
        entry({ sourceId: 'T1', title: '  By the   sea ', timeOfDay: '19:45' }),
        entry({ sourceId: 'T2' }),
      ]));

      const [rows] = entryRepository.save.mock.calls[0];
      expect(rows[0]).toEqual(expect.objectContaining({ title: 'By the sea', timeOfDay: '19:45' }));
      expect(rows[1]).toEqual(expect.objectContaining({ title: null, timeOfDay: null }));
    });

    it('keeps the mood the source app recorded', async () => {
      await service.importEntries(7, batch([entry({ sourceId: 'M1', mood: 4 }), entry({ sourceId: 'M2' })]));

      const [rows] = entryRepository.save.mock.calls[0];
      expect(rows[0]).toEqual(expect.objectContaining({ mood: 4 }));
      expect(rows[1]).toEqual(expect.objectContaining({ mood: null }));
    });

    it('skips entries an earlier import brought in and lists the files they already have', async () => {
      entryRepository.find.mockResolvedValue([{ id: 40, importRef: 'journey:J1' }]);
      attachmentRepository.find.mockResolvedValue([
        { entryId: 40, originalFilename: 'J1-a.jpg' },
        { entryId: 40, originalFilename: 'J1-b.jpg' },
      ]);

      const result = await service.importEntries(
        7,
        batch([entry({ sourceId: 'J1' }), entry({ sourceId: 'J2' })], { source: 'journey' }),
      );

      expect(entryRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 7 }) }),
      );
      expect(entryRepository.save.mock.calls[0][0]).toHaveLength(1);
      expect(result.entries).toEqual([
        { sourceId: 'J1', entryId: 40, alreadyImported: true, attachedFiles: ['J1-a.jpg', 'J1-b.jpg'] },
        { sourceId: 'J2', entryId: 100, alreadyImported: false, attachedFiles: [] },
      ]);
      expect(result.importedCount).toBe(1);
      expect(result.alreadyImportedCount).toBe(1);
    });

    it('writes nothing when the whole batch was imported before', async () => {
      entryRepository.find.mockResolvedValue([{ id: 40, importRef: 'dayone:A1' }]);

      const result = await service.importEntries(7, batch([entry()]));

      expect(entryRepository.save).not.toHaveBeenCalled();
      expect(entryRepository.createQueryBuilder).not.toHaveBeenCalled();
      expect(result.importedCount).toBe(0);
    });

    it('imports an entry listed twice in the same batch once', async () => {
      const result = await service.importEntries(7, batch([entry(), entry()]));

      expect(entryRepository.save.mock.calls[0][0]).toHaveLength(1);
      expect(result.entries.map((item) => item.entryId)).toEqual([100, 100]);
    });

    it('imports into a requested diary the writer owns', async () => {
      diaryRepository.findOne.mockResolvedValue({ id: 5, userId: 7 });

      await service.importEntries(7, batch([entry()], { diaryId: 5 }));

      expect(diaryRepository.findOne).toHaveBeenCalledWith({ where: { id: 5, userId: 7 } });
      expect(entryRepository.save.mock.calls[0][0][0]).toEqual(expect.objectContaining({ diaryId: 5 }));
    });

    it('refuses a diary the writer does not own', async () => {
      diaryRepository.findOne.mockResolvedValue(null);

      await expect(service.importEntries(7, batch([entry()], { diaryId: 99 }))).rejects.toBeInstanceOf(NotFoundException);
      expect(entryRepository.save).not.toHaveBeenCalled();
    });

    it('puts each journal in the diary of the same name and creates the missing ones privately', async () => {
      diaryRepository.find.mockResolvedValue([{ id: 3, name: 'travel' }]);
      diariesService.create.mockResolvedValue({ id: 8, name: 'Dreams' });

      const result = await service.importEntries(
        7,
        batch(
          [
            entry({ sourceId: 'A1', journal: 'Travel' }),
            entry({ sourceId: 'A2', journal: ' Dreams ' }),
            entry({ sourceId: 'A3', journal: 'dreams' }),
            entry({ sourceId: 'A4' }),
          ],
          { journalsAsDiaries: true },
        ),
      );

      expect(diariesService.create).toHaveBeenCalledTimes(1);
      expect(diariesService.create).toHaveBeenCalledWith(7, { name: 'Dreams', visibility: 'private' });
      expect(entryRepository.save.mock.calls[0][0].map((row: { diaryId: number }) => row.diaryId)).toEqual([3, 8, 8, 1]);
      expect(result.createdDiaries).toEqual(['Dreams']);
    });

    it('ignores journal names unless they become diaries', async () => {
      await service.importEntries(7, batch([entry({ journal: 'Travel' })]));

      expect(diaryRepository.find).not.toHaveBeenCalled();
      expect(entryRepository.save.mock.calls[0][0][0]).toEqual(expect.objectContaining({ diaryId: 1 }));
    });

    it('uses the diary a parallel request just created', async () => {
      diaryRepository.find.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 9, name: 'Dreams' }]);
      diariesService.create.mockRejectedValue(new ConflictException('A diary with this name already exists'));

      const result = await service.importEntries(7, batch([entry({ journal: 'Dreams' })], { journalsAsDiaries: true }));

      expect(entryRepository.save.mock.calls[0][0][0]).toEqual(expect.objectContaining({ diaryId: 9 }));
      expect(result.createdDiaries).toEqual([]);
    });

    it('passes on other diary errors', async () => {
      diariesService.create.mockRejectedValue(new Error('database down'));

      await expect(
        service.importEntries(7, batch([entry({ journal: 'Dreams' })], { journalsAsDiaries: true })),
      ).rejects.toThrow('database down');
    });

    it('answers 409 when another request imports the same entries at the same time', async () => {
      entryRepository.save.mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505' }));

      await expect(service.importEntries(7, batch([entry()]))).rejects.toBeInstanceOf(ConflictException);
    });

    it('passes on other save errors', async () => {
      entryRepository.save.mockRejectedValue(new Error('connection lost'));

      await expect(service.importEntries(7, batch([entry()]))).rejects.toThrow('connection lost');
    });
  });

  describe('attachFiles', () => {
    const file = (name: string) => ({ originalname: name, mimetype: 'image/jpeg', size: 10, buffer: Buffer.from('x') }) as Express.Multer.File;

    it('stores each file on the entry at the same position', async () => {
      entryRepository.count.mockResolvedValue(2);
      attachmentsService.upload.mockImplementation(async (_userId: number, upload: Express.Multer.File, entryId: number) => ({
        id: entryId * 10,
        entryId,
        originalFilename: upload.originalname,
      }));

      const result = await service.attachFiles(7, [file('a.jpg'), file('b.jpg'), file('c.jpg')], '12,12,13');

      expect(attachmentsService.upload.mock.calls.map(([, upload, entryId]) => [upload.originalname, entryId])).toEqual([
        ['a.jpg', 12],
        ['b.jpg', 12],
        ['c.jpg', 13],
      ]);
      expect(result.attachments).toEqual([
        { id: 120, entryId: 12, originalFilename: 'a.jpg' },
        { id: 120, entryId: 12, originalFilename: 'b.jpg' },
        { id: 130, entryId: 13, originalFilename: 'c.jpg' },
      ]);
    });

    it('needs one entry ID per file', async () => {
      await expect(service.attachFiles(7, [file('a.jpg')], '12,13')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.attachFiles(7, undefined, '12')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses entries the writer does not own', async () => {
      entryRepository.count.mockResolvedValue(1);

      await expect(service.attachFiles(7, [file('a.jpg'), file('b.jpg')], '12,99')).rejects.toBeInstanceOf(NotFoundException);
      expect(attachmentsService.upload).not.toHaveBeenCalled();
    });

    it('checks every file before storing any of them', async () => {
      entryRepository.count.mockResolvedValue(1);
      attachmentsService.assertUploadable
        .mockImplementationOnce(() => undefined)
        .mockImplementationOnce(() => {
          throw new BadRequestException('File type video/quicktime is not allowed');
        });

      await expect(service.attachFiles(7, [file('a.jpg'), file('b.mov')], '12,12')).rejects.toBeInstanceOf(BadRequestException);
      expect(attachmentsService.upload).not.toHaveBeenCalled();
    });
  });
});
