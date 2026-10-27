import { createEntriesCommandTestBed, type EntriesCommandTestBed } from './entries-command.test-helpers';

describe('EntriesCommandService time capsules', () => {
  let bed: EntriesCommandTestBed;
  const sealedUntil = new Date('2027-10-27T07:00:00Z');

  beforeEach(() => {
    bed = createEntriesCommandTestBed();
    bed.diaryRepository.findOne.mockResolvedValue({ id: 2 });
    bed.entryRepository.count.mockResolvedValue(1);
    bed.entryTaggingService.resolveSavedTags.mockResolvedValue(['future-self']);
  });

  it('seals a new entry through the capsule service with everything that was written', async () => {
    const seal = { opensOn: '2027-10-27', openHour: 9, timeZone: 'Europe/Paris' };

    await expect(bed.service.create(5, {
      text: 'Dear future me',
      title: 'A letter',
      tags: ['future-self'],
      date: '2026-10-27',
      visibility: 'public',
      seal,
    })).resolves.toEqual({ success: true, entryId: 99 });

    expect(bed.timeCapsules.createSealed).toHaveBeenCalledWith(5, expect.objectContaining({
      userId: 5,
      date: '2026-10-27',
      index: 2,
      title: 'A letter',
      content: 'Dear future me',
      tags: ['future-self'],
      diaryId: 2,
    }), seal);
    expect(bed.entryMentions.save).not.toHaveBeenCalled();
  });

  it('refuses to edit a sealed entry or change its visibility, before keeping any revision', async () => {
    bed.entryRepository.findOne.mockResolvedValue({ id: 1, userId: 5, sealedUntil, visibility: 'private' });

    await expect(bed.service.update(5, 1, { text: 'Peek', tags: [], date: '2026-10-27' })).rejects.toMatchObject({
      response: { code: 'ENTRY_SEALED', statusCode: 409 },
    });
    await expect(bed.service.updateVisibility(5, 1, 'public')).rejects.toMatchObject({ response: { code: 'ENTRY_SEALED' } });
    expect(bed.revisionRepository.save).not.toHaveBeenCalled();
    expect(bed.entryRepository.save).not.toHaveBeenCalled();
  });

  it('leaves sealed entries out of bulk visibility and tag changes, which keep them private and as written', async () => {
    bed.entryRepository.find.mockResolvedValue([
      { id: 1, userId: 5, tags: ['a'], sealedUntil: null },
      { id: 2, userId: 5, tags: [], sealedUntil },
    ]);

    await expect(bed.service.bulkOperation(5, { ids: [1, 2], action: 'visibility', visibility: 'public' })).resolves.toEqual({
      success: true,
      affectedCount: 1,
    });
    expect(bed.entryRepository.update).toHaveBeenCalledWith(expect.objectContaining({ userId: 5 }), { visibility: 'public' });
    expect(bed.entryRepository.update.mock.calls[0][0].id.value).toEqual([1]);

    await expect(bed.service.bulkOperation(5, { ids: [1, 2], action: 'tags', tags: ['b'] })).resolves.toEqual({
      success: true,
      affectedCount: 1,
    });
    expect(bed.entryRepository.save).toHaveBeenCalledTimes(1);
    expect(bed.entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 1, tags: ['a', 'b'] }));
  });

  it('changes nothing when every entry of a bulk visibility change is sealed', async () => {
    bed.entryRepository.find.mockResolvedValue([{ id: 2, userId: 5, tags: [], sealedUntil }]);

    await expect(bed.service.bulkOperation(5, { ids: [2], action: 'visibility', visibility: 'public' })).resolves.toEqual({
      success: true,
      affectedCount: 0,
    });
    expect(bed.entryRepository.update).not.toHaveBeenCalled();
  });

  it('still moves, archives and deletes sealed entries in bulk', async () => {
    bed.entryRepository.find.mockResolvedValue([{ id: 2, userId: 5, date: '2026-10-27', tags: [], sealedUntil }]);

    await expect(bed.service.bulkOperation(5, { ids: [2], action: 'archive', isArchived: true })).resolves.toEqual({
      success: true,
      affectedCount: 1,
    });
    expect(bed.entryRepository.update).toHaveBeenCalledWith(expect.anything(), { isArchived: true });
  });
});
