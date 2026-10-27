import { createEntriesCommandTestBed, type EntriesCommandTestBed } from './entries-command.test-helpers';

describe('EntriesCommandService inline images', () => {
  let bed: EntriesCommandTestBed;

  beforeEach(() => {
    bed = createEntriesCommandTestBed();
    bed.diaryRepository.findOne.mockResolvedValue({ id: 1 });
    bed.entryRepository.count.mockResolvedValue(0);
    bed.entryRepository.save.mockImplementation(async (value: object) => ({ id: 42, ...value }));
    bed.inlineImages.check.mockResolvedValue({ content: 'Checked ![x](attachment:3)', placed: [3] });
  });

  it('saves a new entry with its checked text and then places the attachments it names', async () => {
    await bed.service.create(7, { text: 'Typed ![x](attachment:3)', tags: [], format: 'markdown' });

    expect(bed.inlineImages.check).toHaveBeenCalledWith(7, { content: 'Typed ![x](attachment:3)', format: 'markdown' });
    expect(bed.entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ content: 'Checked ![x](attachment:3)', format: 'markdown' }));
    expect(bed.inlineImages.attachPlaced).toHaveBeenCalledWith(7, 42, [3]);
  });

  it('places the attachments of a sealed time capsule on it too', async () => {
    await bed.service.create(7, {
      text: 'Later',
      tags: [],
      format: 'markdown',
      seal: { opensOn: '2030-01-01', openHour: 9, timeZone: 'UTC' },
    });

    expect(bed.timeCapsules.createSealed).toHaveBeenCalledWith(7, expect.objectContaining({ content: 'Checked ![x](attachment:3)' }), expect.anything());
    expect(bed.inlineImages.attachPlaced).toHaveBeenCalledWith(7, 99, [3]);
  });

  it('checks an edit against the entry and the text it held before', async () => {
    bed.entryRepository.findOne.mockResolvedValue({ id: 5, userId: 7, date: '2024-01-10', index: 1, content: 'Before', format: 'markdown', tags: [] });

    await bed.service.update(7, 5, { text: 'After ![x](attachment:3)', tags: [], date: '2024-01-10' });

    expect(bed.inlineImages.check).toHaveBeenCalledWith(7, {
      content: 'After ![x](attachment:3)',
      format: 'markdown',
      entryId: 5,
      previousContent: 'Before',
    });
    expect(bed.revisionRepository.save).toHaveBeenCalledWith(expect.objectContaining({ content: 'Before' }));
    expect(bed.entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ content: 'Checked ![x](attachment:3)' }));
    expect(bed.inlineImages.attachPlaced).toHaveBeenCalledWith(7, 5, [3]);
  });
});
