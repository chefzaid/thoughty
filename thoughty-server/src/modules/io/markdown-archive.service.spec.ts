import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import JSZip from 'jszip';
import { Diary, Entry } from '@/database/entities';
import { AttachmentsService } from '@/modules/attachments';
import { ConfigService } from '@/modules/config';
import { MarkdownArchiveService } from './markdown-archive.service';

describe('MarkdownArchiveService', () => {
  let service: MarkdownArchiveService;
  let entries: Array<Partial<Entry>>;
  let queryBuilder: Record<string, jest.Mock>;
  let diaryRepository: { find: jest.Mock };
  let attachmentsService: { getFileBuffer: jest.Mock };
  let configService: { getConfig: jest.Mock };

  const diaries = [
    { id: 1, userId: 7, name: 'Journal', position: 0 },
    { id: 2, userId: 7, name: 'Travel: Spain', position: 1 },
  ];
  const photo = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const baseEntry = {
    tags: [],
    format: 'markdown' as const,
    visibility: 'private' as const,
    isFavorite: false,
    isArchived: false,
    attachments: [],
  };

  async function buildArchive(diaryId?: number): Promise<{ filename: string; zip: JSZip }> {
    const archive = await service.prepare(7, diaryId);
    const chunks: Buffer[] = [];
    await archive.write(async (chunk) => {
      chunks.push(chunk);
    });
    return { filename: archive.filename, zip: await JSZip.loadAsync(Buffer.concat(chunks), { checkCRC32: true }) };
  }

  beforeEach(async () => {
    entries = [];
    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => entries),
    };
    diaryRepository = { find: jest.fn().mockResolvedValue(diaries) };
    attachmentsService = { getFileBuffer: jest.fn().mockResolvedValue(photo) };
    configService = { getConfig: jest.fn().mockResolvedValue({ language: 'en' }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MarkdownArchiveService,
        { provide: getRepositoryToken(Entry), useValue: { createQueryBuilder: jest.fn(() => queryBuilder) } },
        { provide: getRepositoryToken(Diary), useValue: diaryRepository },
        { provide: AttachmentsService, useValue: attachmentsService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();
    service = moduleRef.get(MarkdownArchiveService);
  });

  it('writes one Markdown file per entry in diary and year folders, with attachments beside them', async () => {
    entries = [
      { ...baseEntry, id: 1, diaryId: 1, date: '2023-12-31', index: 1, content: 'Last day of the year.', tags: ['new-year'] },
      { ...baseEntry, id: 2, diaryId: 2, date: '2024-03-05', index: 1, content: 'Arrived in Seville.', isFavorite: true },
      {
        ...baseEntry,
        id: 3,
        diaryId: 2,
        date: '2024-03-05',
        index: 2,
        content: 'Beach.',
        attachments: [
          { id: 30, originalFilename: 'beach.JPG', storedFilename: 'uuid-1.jpg', mimetype: 'image/jpeg', transcript: null },
          { id: 31, originalFilename: 'beach.JPG', storedFilename: 'uuid-2.jpg', mimetype: 'image/jpeg', transcript: null },
        ] as Entry['attachments'],
      },
      { ...baseEntry, id: 4, diaryId: null, date: '2024-04-01', index: 1, content: 'From a deleted diary.' },
    ];

    const { filename, zip } = await buildArchive();

    expect(filename).toMatch(/^thoughty_all_diaries_\d{4}-\d{2}-\d{2}\.zip$/);
    expect(Object.keys(zip.files).sort()).toEqual([
      'Journal/2023/2023-12-31.md',
      'No diary/2024/2024-04-01.md',
      'README.md',
      'Travel- Spain/2024/2024-03-05-2.md',
      'Travel- Spain/2024/2024-03-05.md',
      'Travel- Spain/2024/attachments/2024-03-05-beach-2.jpg',
      'Travel- Spain/2024/attachments/2024-03-05-beach.jpg',
    ]);
    await expect(zip.file('README.md')!.async('string')).resolves.toContain('4 entries in 3 diaries.');
    await expect(zip.file('Journal/2023/2023-12-31.md')!.async('string')).resolves.toBe(
      '---\ndate: 2023-12-31\ndiary: "Journal"\ntags: ["new-year"]\nvisibility: private\nformat: markdown\n---\n\nLast day of the year.\n',
    );
    await expect(zip.file('Travel- Spain/2024/2024-03-05.md')!.async('string')).resolves.toContain('favorite: true');
    const withPhotos = await zip.file('Travel- Spain/2024/2024-03-05-2.md')!.async('string');
    expect(withPhotos).toContain('Beach.\n\n![beach.JPG](<attachments/2024-03-05-beach.jpg>)\n\n![beach.JPG](<attachments/2024-03-05-beach-2.jpg>)\n');
    await expect(zip.file('Travel- Spain/2024/attachments/2024-03-05-beach.jpg')!.async('nodebuffer')).resolves.toEqual(photo);
    expect(attachmentsService.getFileBuffer).toHaveBeenCalledWith('uuid-1.jpg', 5 * 1024 * 1024);
    await expect(zip.file('No diary/2024/2024-04-01.md')!.async('string')).resolves.not.toContain('diary:');
  });

  it('names an entry\'s file after its date and title and keeps the time in the front matter', async () => {
    entries = [
      { ...baseEntry, id: 1, diaryId: 1, date: '2024-05-01', index: 1, title: 'May Day: picnic?', timeOfDay: '12:30', content: 'Sun.' },
    ];

    const { zip } = await buildArchive();

    expect(Object.keys(zip.files)).toContain('Journal/2024/2024-05-01 May Day- picnic-.md');
    const markdown = await zip.file('Journal/2024/2024-05-01 May Day- picnic-.md')!.async('string');
    expect(markdown).toContain('title: "May Day: picnic?"\ndate: 2024-05-01\ntime: "12:30"');
  });

  it('exports one diary under its own name', async () => {
    entries = [{ ...baseEntry, id: 2, diaryId: 2, date: '2024-03-05', index: 1, content: 'Arrived.' }];

    const { filename, zip } = await buildArchive(2);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 2 });
    expect(filename).toMatch(/^thoughty_Travel__Spain_\d{4}-\d{2}-\d{2}\.zip$/);
    expect(Object.keys(zip.files)).toContain('Travel- Spain/2024/2024-03-05.md');
  });

  it('refuses a diary the writer does not own before anything is written', async () => {
    await expect(service.prepare(7, 99)).rejects.toBeInstanceOf(NotFoundException);
    expect(queryBuilder.getMany).not.toHaveBeenCalled();
  });

  it('leaves out an attachment that storage no longer has and keeps the entry', async () => {
    attachmentsService.getFileBuffer.mockRejectedValue(new Error('NoSuchKey'));
    entries = [
      {
        ...baseEntry,
        id: 3,
        diaryId: 1,
        date: '2024-03-05',
        index: 1,
        content: 'Beach.',
        attachments: [{ id: 30, originalFilename: 'beach.jpg', storedFilename: 'gone.jpg', mimetype: 'image/jpeg' }] as Entry['attachments'],
      },
    ];

    const { zip } = await buildArchive();

    expect(Object.keys(zip.files).sort()).toEqual(['Journal/2024/2024-03-05.md', 'README.md']);
    await expect(zip.file('Journal/2024/2024-03-05.md')!.async('string')).resolves.not.toContain('beach.jpg');
  });

  it('writes the README and folder names in French for French writers', async () => {
    configService.getConfig.mockResolvedValue({ language: 'fr' });
    entries = [{ ...baseEntry, id: 4, diaryId: null, date: '2024-04-01', index: 1, content: 'Hors journal.' }];

    const { zip } = await buildArchive();

    expect(Object.keys(zip.files)).toContain('Sans journal/2024/2024-04-01.md');
    await expect(zip.file('README.md')!.async('string')).resolves.toContain('1 entrée dans 1 journal.');
  });

  it('accepts dates that the driver returns as Date objects', async () => {
    entries = [{ ...baseEntry, id: 1, diaryId: 1, date: new Date('2022-07-14T00:00:00Z') as unknown as string, index: 1, content: 'Fireworks.' }];

    const { zip } = await buildArchive();

    expect(Object.keys(zip.files)).toContain('Journal/2022/2022-07-14.md');
  });
});
