import { In, IsNull } from 'typeorm';
import { EntryInlineImagesService } from './entry-inline-images.service';

describe('EntryInlineImagesService', () => {
  let attachmentRepository: { find: jest.Mock; update: jest.Mock };
  let entryRepository: { find: jest.Mock; update: jest.Mock };
  let service: EntryInlineImagesService;

  beforeEach(() => {
    // Attachment 1 is on entry 10, 2 on entry 20, 3 on no entry yet; 4 is not the writer's
    attachmentRepository = {
      find: jest.fn().mockResolvedValue([
        { id: 1, entryId: 10 },
        { id: 2, entryId: 20 },
        { id: 3, entryId: null },
      ]),
      update: jest.fn(),
    };
    entryRepository = { find: jest.fn(), update: jest.fn() };
    service = new EntryInlineImagesService(attachmentRepository as never, entryRepository as never);
  });

  it('keeps the entry’s own and unplaced attachments and turns the others into their alt text', async () => {
    const result = await service.check(7, {
      content: 'A ![own](attachment:1) B ![other entry](attachment:2) C ![new](attachment:3) D ![stranger](attachment:4) E ![file](attachment:a.jpg)',
      format: 'markdown',
      entryId: 10,
    });

    expect(attachmentRepository.find).toHaveBeenCalledWith({
      select: { id: true, entryId: true },
      where: { userId: 7, id: In([1, 2, 3, 4]) },
    });
    expect(result).toEqual({
      content: 'A ![own](attachment:1) B other entry C ![new](attachment:3) D stranger E file',
      placed: [3],
    });
  });

  it('keeps references already in the saved text, whose attachment may since be gone', async () => {
    attachmentRepository.find.mockResolvedValue([]);
    const result = await service.check(7, {
      content: '![Renamed](attachment:5) ![waiting](attachment:b.jpg) ![pasted](attachment:6)',
      format: 'markdown',
      entryId: 10,
      previousContent: 'Old ![Old](attachment:5) ![](attachment:b.jpg)',
    });

    expect(result).toEqual({ content: '![Renamed](attachment:5) ![waiting](attachment:b.jpg) pasted', placed: [] });
  });

  it('places nothing in a new entry but the writer’s unplaced attachments', async () => {
    const result = await service.check(7, { content: '![a](attachment:1) ![b](attachment:3)', format: 'markdown' });
    expect(result).toEqual({ content: 'a ![b](attachment:3)', placed: [3] });
  });

  it('saves plain text, and Markdown without references, without asking the database', async () => {
    await expect(service.check(7, { content: '![a](attachment:2)', format: 'plain' })).resolves.toEqual({
      content: '![a](attachment:2)',
      placed: [],
    });
    await expect(service.check(7, { content: 'No pictures', format: 'markdown' })).resolves.toEqual({
      content: 'No pictures',
      placed: [],
    });
    expect(attachmentRepository.find).not.toHaveBeenCalled();
  });

  it('puts placed attachments on the entry unless another entry took them first', async () => {
    await service.attachPlaced(7, 10, []);
    expect(attachmentRepository.update).not.toHaveBeenCalled();

    await service.attachPlaced(7, 10, [3]);
    expect(attachmentRepository.update).toHaveBeenCalledWith({ userId: 7, id: In([3]), entryId: IsNull() }, { entryId: 10 });
  });

  it('turns the file names of an import into references to the stored files', async () => {
    entryRepository.find.mockResolvedValue([
      { id: 10, content: 'Sea ![Pier](attachment:a.jpg) ![](attachment:missing.jpg)' },
      { id: 11, content: 'No pictures' },
    ]);

    await service.resolveImportedFiles(7, [
      { id: 31, entryId: 10, originalFilename: 'a.jpg' },
      { id: 32, entryId: 10, originalFilename: 'a.jpg' },
      { id: 33, entryId: 11, originalFilename: 'b.jpg' },
    ]);

    expect(entryRepository.find).toHaveBeenCalledWith({
      select: { id: true, content: true },
      where: { userId: 7, id: In([10, 11]) },
    });
    expect(entryRepository.update).toHaveBeenCalledTimes(1);
    expect(entryRepository.update).toHaveBeenCalledWith(
      { id: 10, userId: 7 },
      { content: 'Sea ![Pier](attachment:31) ![](attachment:missing.jpg)' },
    );
  });

  it('reads no entries when an import stored no files', async () => {
    await service.resolveImportedFiles(7, []);
    expect(entryRepository.find).not.toHaveBeenCalled();
  });
});
