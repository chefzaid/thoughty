import { ServiceUnavailableException } from '@nestjs/common';
import { createEntriesCommandTestBed } from './entries-command.test-helpers';

const disabled = expect.objectContaining({
  response: expect.objectContaining({ code: 'FEATURE_DISABLED' }),
});

describe('EntriesCommandService while public sharing is off', () => {
  const entry = (visibility: 'public' | 'private') => ({
    id: 3,
    userId: 1,
    date: '2024-01-15',
    index: 1,
    content: 'Saved text',
    format: 'plain',
    visibility,
    tags: [],
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('refuses a new public entry and saves nothing', async () => {
    const { service, entryRepository } = createEntriesCommandTestBed({ publicSharing: false });

    await expect(service.create(1, { text: 'Hello', tags: [], visibility: 'public' })).rejects.toThrow(ServiceUnavailableException);
    await expect(service.create(1, { text: 'Hello', tags: [], visibility: 'public' })).rejects.toEqual(disabled);
    expect(entryRepository.save).not.toHaveBeenCalled();
  });

  it('still creates private entries', async () => {
    const { service, entryRepository, diaryRepository } = createEntriesCommandTestBed({ publicSharing: false });
    diaryRepository.findOne.mockResolvedValue({ id: 4 });
    entryRepository.count.mockResolvedValue(0);
    entryRepository.save.mockResolvedValue({ id: 8 });

    await expect(service.create(1, { text: 'Hello', tags: [], visibility: 'private' })).resolves.toEqual({ success: true, entryId: 8 });
  });

  it('refuses to make a private entry public, before keeping a revision', async () => {
    const { service, entryRepository, revisionRepository } = createEntriesCommandTestBed({ publicSharing: false });
    entryRepository.findOne.mockResolvedValue(entry('private'));

    await expect(service.update(1, 3, { text: 'Edited', tags: [], date: '2024-01-15', visibility: 'public' })).rejects.toEqual(disabled);
    await expect(service.updateVisibility(1, 3, 'public')).rejects.toEqual(disabled);
    expect(revisionRepository.save).not.toHaveBeenCalled();
    expect(entryRepository.save).not.toHaveBeenCalled();
  });

  it('keeps an entry that is already public editable as it is, and lets it become private', async () => {
    const { service, entryRepository } = createEntriesCommandTestBed({ publicSharing: false });
    entryRepository.findOne.mockResolvedValue(entry('public'));
    entryRepository.save.mockImplementation(async (value: unknown) => value);

    const edited = await service.update(1, 3, { text: 'Edited', tags: [], date: '2024-01-15', visibility: 'public' });
    expect(edited.entry.visibility).toBe('public');

    entryRepository.findOne.mockResolvedValue(entry('public'));
    const hidden = await service.updateVisibility(1, 3, 'private');
    expect(hidden.entry.visibility).toBe('private');
  });

  it('refuses to make entries public in bulk, and still makes them private', async () => {
    const { service, entryRepository } = createEntriesCommandTestBed({ publicSharing: false });
    entryRepository.find.mockResolvedValue([entry('private')]);

    await expect(service.bulkOperation(1, { ids: [3], action: 'visibility', visibility: 'public' })).rejects.toEqual(disabled);
    expect(entryRepository.update).not.toHaveBeenCalled();

    await expect(service.bulkOperation(1, { ids: [3], action: 'visibility', visibility: 'private' }))
      .resolves.toEqual({ success: true, affectedCount: 1 });
  });

  it('makes entries public while public sharing is on', async () => {
    const { service, entryRepository } = createEntriesCommandTestBed();
    entryRepository.findOne.mockResolvedValue(entry('private'));
    entryRepository.save.mockImplementation(async (value: unknown) => value);

    const published = await service.updateVisibility(1, 3, 'public');

    expect(published.entry.visibility).toBe('public');
  });
});
