import { IoService } from './io.service';
import { createIoServiceTestBed, mockDiary } from './io.test-helpers';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function attachment(id: number, name: string) {
  return { id, originalFilename: name, storedFilename: `key-${id}.png`, mimetype: 'image/png', size: png.length };
}

const placedEntry = {
  id: 1,
  userId: 1,
  diaryId: 1,
  date: '2024-01-15',
  index: 1,
  tags: [],
  format: 'markdown',
  visibility: 'private',
  content: 'Morning ![The pier](attachment:5) and ![Gone](attachment:8)',
  attachments: [attachment(5, 'pier.png'), attachment(6, 'unplaced.png')],
};

describe('IoService inline images', () => {
  let service: IoService;
  let entryRepository: any;
  let diaryRepository: any;
  let settingRepository: any;
  let attachmentsService: { getFileBuffer: jest.Mock };

  beforeEach(async () => {
    ({ service, entryRepository, diaryRepository, settingRepository, attachmentsService } = await createIoServiceTestBed());
    entryRepository.createQueryBuilder().getMany.mockResolvedValue([placedEntry]);
    attachmentsService.getFileBuffer.mockResolvedValue(png);
  });

  it('embeds in document exports only the images the text places, where it places them', async () => {
    const result = await service.export(1, undefined, false, 'html');
    const html = String(result.content);

    expect(entryRepository.createQueryBuilder().leftJoinAndSelect).toHaveBeenCalledWith(
      'e.attachments',
      'documentImage',
      '(documentImage.mimetype IN (:...imageTypes) OR documentImage.poster_filename IS NOT NULL)',
      { imageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] },
    );
    expect(attachmentsService.getFileBuffer).toHaveBeenCalledTimes(1);
    expect(attachmentsService.getFileBuffer).toHaveBeenCalledWith('key-5.png', 5 * 1024 * 1024);
    expect(html).toContain('Morning <figure class="entry-image inline-image"><img src="data:image/png;base64,');
    expect(html).toContain(' and Gone</div>');
    expect(html).not.toContain('unplaced.png');
    expect(html).not.toContain('key-5');
  });

  it('keeps the references of data files as written', async () => {
    settingRepository.find.mockResolvedValue([]);
    const result = await service.export(1, undefined, false, 'json');

    expect(String(result.content)).toContain('![The pier](attachment:5)');
    expect(entryRepository.createQueryBuilder().leftJoinAndSelect).not.toHaveBeenCalled();
  });

  it('imports a Markdown entry’s inline images as their alt text, since a file carries no attachments', async () => {
    settingRepository.find.mockResolvedValue([]);
    diaryRepository.findOne.mockResolvedValue(mockDiary);
    entryRepository.count.mockResolvedValue(0);
    entryRepository.save.mockImplementation(async (value: object) => value);

    await service.import(1, {
      content: JSON.stringify([
        { date: '2024-01-15', tags: [], format: 'markdown', content: 'Sea ![The pier](attachment:5)' },
        { date: '2024-01-16', tags: [], format: 'plain', content: 'Kept ![x](attachment:5)' },
      ]),
      skipDuplicates: false,
    });

    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ content: 'Sea The pier' }));
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ content: 'Kept ![x](attachment:5)' }));
  });
});
