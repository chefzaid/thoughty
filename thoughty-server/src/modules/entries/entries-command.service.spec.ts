import { NotFoundException } from '@nestjs/common';
import { EntriesCommandService } from './entries-command.service';
import { createEntriesCommandTestBed } from './entries-command.test-helpers';

describe('EntriesCommandService', () => {
  let service: EntriesCommandService;
  let entryRepository: Record<string, jest.Mock>;
  let revisionRepository: Record<string, jest.Mock>;
  let diaryRepository: Record<string, jest.Mock>;
  let entryTaggingService: Record<string, jest.Mock>;

  beforeEach(() => {
    ({ service, entryRepository, revisionRepository, diaryRepository, entryTaggingService } = createEntriesCommandTestBed());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates an entry using the default diary and AI-suggested tags when capacity remains', async () => {
    entryTaggingService.resolveSavedTags.mockResolvedValue(['work', 'ai']);
    diaryRepository.findOne.mockResolvedValue({ id: 42 });
    entryRepository.count.mockResolvedValue(2);
    entryRepository.save.mockResolvedValue({ id: 7 });

    const result = await service.create(5, {
      text: 'Hello world',
      tags: [' work ', 'work'],
      date: '2024-01-15',
    });

    expect(diaryRepository.findOne).toHaveBeenCalledWith({ where: { userId: 5, isDefault: true } });
    expect(entryTaggingService.resolveSavedTags).toHaveBeenCalledWith(5, 'Hello world', [' work ', 'work']);
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: 5,
      date: '2024-01-15',
      index: 3,
      tags: ['work', 'ai'],
      content: 'Hello world',
      format: 'plain',
      visibility: 'private',
      diaryId: 42,
    }));
    expect(result).toEqual({ success: true, entryId: 7 });
  });

  it('creates an entry without requesting AI tags when auto-tagging is disabled', async () => {
    entryTaggingService.resolveSavedTags.mockResolvedValue(['focus']);
    diaryRepository.findOne.mockResolvedValue(null);
    entryRepository.count.mockResolvedValue(0);
    entryRepository.save.mockResolvedValue({ id: 9 });

    const result = await service.create(2, {
      text: 'Manual tags only',
      tags: ['focus'],
      format: 'markdown',
      visibility: 'public',
    });

    expect(entryTaggingService.resolveSavedTags).toHaveBeenCalledWith(2, 'Manual tags only', ['focus']);
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      diaryId: undefined,
      format: 'markdown',
      visibility: 'public',
    }));
    expect(result).toEqual({ success: true, entryId: 9 });
  });

  it('creates an entry in a requested diary the writer owns', async () => {
    diaryRepository.findOne.mockResolvedValue({ id: 12, userId: 4 });
    entryRepository.count.mockResolvedValue(0);
    entryRepository.save.mockResolvedValue({ id: 15 });

    await service.create(4, { text: 'In my travel diary', tags: [], diaryId: 12 });

    expect(diaryRepository.findOne).toHaveBeenCalledWith({ where: { id: 12, userId: 4 } });
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ diaryId: 12 }));
  });

  it('rejects an entry aimed at a diary the writer does not own', async () => {
    diaryRepository.findOne.mockResolvedValue(null);

    await expect(service.create(4, { text: 'Not my diary', tags: [], diaryId: 99 }))
      .rejects.toThrow(NotFoundException);

    expect(diaryRepository.findOne).toHaveBeenCalledWith({ where: { id: 99, userId: 4 } });
    expect(entryTaggingService.resolveSavedTags).not.toHaveBeenCalled();
    expect(entryRepository.save).not.toHaveBeenCalled();
  });

  it('updates an entry, writes a revision, and reindexes the original day when the date changes', async () => {
    const existingEntry = {
      id: 3,
      userId: 8,
      content: 'Old text',
      tags: ['old'],
      date: '2024-01-10',
      format: 'plain',
      visibility: 'private',
      index: 2,
    };
    const remainingEntries = [
      { id: 10, userId: 8, date: '2024-01-10', index: 4 },
      { id: 11, userId: 8, date: '2024-01-10', index: 7 },
    ];

    entryRepository.findOne.mockResolvedValue(existingEntry);
    entryRepository.count.mockResolvedValue(1);
    revisionRepository.save.mockResolvedValue({ id: 101 });
    entryRepository.save
      .mockResolvedValueOnce({ ...existingEntry, content: 'New text', date: '2024-01-11', index: 2 })
      .mockResolvedValueOnce({ ...remainingEntries[0], index: 1 })
      .mockResolvedValueOnce({ ...remainingEntries[1], index: 2 });
    entryRepository.find.mockResolvedValue(remainingEntries);

    const result = await service.update(8, 3, {
      text: 'New text',
      tags: ['updated'],
      date: '2024-01-11',
      visibility: 'public',
      format: 'markdown',
    });

    expect(revisionRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      entryId: 3,
      userId: 8,
      content: 'Old text',
      tags: ['old'],
      date: '2024-01-10',
      format: 'plain',
      visibility: 'private',
    }));
    expect(entryRepository.find).toHaveBeenCalledWith({
      where: { userId: 8, date: '2024-01-10' },
      order: { index: 'ASC' },
    });
    expect(entryRepository.save).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 10, index: 1 }));
    expect(entryRepository.save).toHaveBeenNthCalledWith(3, expect.objectContaining({ id: 11, index: 2 }));
    expect(result).toEqual({ success: true, entry: expect.objectContaining({ content: 'New text', date: '2024-01-11', index: 2 }) });
  });

  it('numbers a new entry after the day whatever its time, and keeps its title on one line', async () => {
    diaryRepository.findOne.mockResolvedValue({ id: 42 });
    entryRepository.count.mockResolvedValue(2);
    entryRepository.save.mockResolvedValue({ id: 8 });

    await service.create(5, {
      text: 'Early swim',
      tags: ['swim'],
      date: '2024-01-15',
      title: '  Before\nsunrise ',
      timeOfDay: '06:15',
    });

    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      index: 3,
      title: 'Before sunrise',
      timeOfDay: '06:15',
    }));
  });

  it('stores no title or time when they are empty', async () => {
    diaryRepository.findOne.mockResolvedValue({ id: 42 });
    entryRepository.count.mockResolvedValue(0);
    entryRepository.save.mockResolvedValue({ id: 8 });

    await service.create(5, { text: 'Plain', tags: ['a'], title: ' ', timeOfDay: '' });

    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ title: null, timeOfDay: null }));
  });

  it('keeps the title and time in the revision and leaves them alone when an edit omits them', async () => {
    const existingEntry = {
      id: 3,
      userId: 8,
      content: 'Old text',
      title: 'Old title',
      timeOfDay: '09:00',
      tags: ['old'],
      date: '2024-01-10',
      format: 'plain',
      visibility: 'private',
      index: 2,
    };
    entryRepository.findOne.mockResolvedValue({ ...existingEntry });
    entryRepository.save.mockImplementation(async (entry) => entry);

    const kept = await service.update(8, 3, { text: 'Rephrased', tags: ['old'], date: '2024-01-10' });

    expect(revisionRepository.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Old title', timeOfDay: '09:00' }));
    expect(kept.entry).toMatchObject({ content: 'Rephrased', title: 'Old title', timeOfDay: '09:00', index: 2 });

    entryRepository.findOne.mockResolvedValue({ ...existingEntry });
    const changed = await service.update(8, 3, { text: 'Old text', tags: ['old'], date: '2024-01-10', title: 'New title', timeOfDay: '17:20' });
    expect(changed.entry).toMatchObject({ title: 'New title', timeOfDay: '17:20', index: 2 });

    entryRepository.findOne.mockResolvedValue({ ...existingEntry });
    const cleared = await service.update(8, 3, { text: 'Old text', tags: ['old'], date: '2024-01-10', title: null, timeOfDay: null });
    expect(cleared.entry).toMatchObject({ title: null, timeOfDay: null, index: 2 });
    expect(entryRepository.find).not.toHaveBeenCalled();
  });

  it('stores a recorded mood with cleaned feeling words, and none when left out', async () => {
    diaryRepository.findOne.mockResolvedValue({ id: 42 });
    entryRepository.count.mockResolvedValue(0);
    entryRepository.save.mockResolvedValue({ id: 8 });

    await service.create(5, { text: 'Good day', tags: ['a'], mood: 4, feelings: [' Calm ', 'calm', 'Grateful'] });
    await service.create(5, { text: 'Plain', tags: ['a'] });

    expect(entryRepository.save).toHaveBeenNthCalledWith(1, expect.objectContaining({ mood: 4, feelings: ['calm', 'grateful'] }));
    expect(entryRepository.save).toHaveBeenNthCalledWith(2, expect.objectContaining({ mood: null, feelings: [] }));
  });

  it('keeps the mood in the revision and leaves it alone when an edit omits it', async () => {
    const existingEntry = {
      id: 3,
      userId: 8,
      content: 'Old text',
      mood: 2,
      feelings: ['tired'],
      tags: ['old'],
      date: '2024-01-10',
      format: 'plain',
      visibility: 'private',
      index: 1,
    };
    entryRepository.findOne.mockResolvedValue({ ...existingEntry });
    entryRepository.save.mockImplementation(async (entry) => entry);

    const kept = await service.update(8, 3, { text: 'Rephrased', tags: ['old'], date: '2024-01-10' });

    expect(revisionRepository.save).toHaveBeenCalledWith(expect.objectContaining({ mood: 2, feelings: ['tired'] }));
    expect(kept.entry).toMatchObject({ mood: 2, feelings: ['tired'] });

    entryRepository.findOne.mockResolvedValue({ ...existingEntry });
    const changed = await service.update(8, 3, { text: 'Old text', tags: ['old'], date: '2024-01-10', mood: 5, feelings: ['Relieved'] });
    expect(changed.entry).toMatchObject({ mood: 5, feelings: ['relieved'] });

    entryRepository.findOne.mockResolvedValue({ ...existingEntry });
    const cleared = await service.update(8, 3, { text: 'Old text', tags: ['old'], date: '2024-01-10', mood: null, feelings: [] });
    expect(cleared.entry).toMatchObject({ mood: null, feelings: [] });
  });

  it('throws when updating a missing entry', async () => {
    entryRepository.findOne.mockResolvedValue(null);

    await expect(service.update(3, 99, {
      text: 'Missing',
      tags: [],
      date: '2024-01-11',
    })).rejects.toThrow(NotFoundException);
  });
});
