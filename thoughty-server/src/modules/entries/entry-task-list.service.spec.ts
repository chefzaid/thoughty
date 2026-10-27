import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Entry, EntryRevision } from '@/database/entities';
import { EntryTaskListService, revisionCoversTicks, TASK_REVISION_WINDOW_MS } from './entry-task-list.service';

describe('EntryTaskListService', () => {
  let entryRepository: Record<string, jest.Mock>;
  let revisionRepository: Record<string, jest.Mock>;
  let service: EntryTaskListService;

  const entry = (overrides: Partial<Entry> = {}): Entry => ({
    id: 4,
    userId: 1,
    content: '- [ ] Call the bank\n- [ ] Post the letter',
    format: 'markdown',
    title: null,
    timeOfDay: null,
    mood: null,
    feelings: [],
    tags: ['errands'],
    date: '2024-01-15',
    visibility: 'private',
    ...overrides,
  }) as Entry;

  const revisionOf = (source: Entry, createdAt: Date, overrides: Partial<EntryRevision> = {}): EntryRevision => ({
    id: 9,
    entryId: source.id,
    userId: source.userId,
    content: source.content,
    title: source.title,
    timeOfDay: source.timeOfDay,
    mood: source.mood,
    feelings: source.feelings,
    tags: source.tags,
    date: source.date,
    format: source.format,
    visibility: source.visibility,
    createdAt,
    ...overrides,
  }) as EntryRevision;

  beforeEach(() => {
    entryRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (saved: Entry) => saved),
    };
    revisionRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    };
    const manager = {
      getRepository: jest.fn((target: unknown) => (target === Entry ? entryRepository : revisionRepository)),
    };
    const dataSource = { transaction: jest.fn(async (work: (m: typeof manager) => unknown) => work(manager)) };
    service = new EntryTaskListService(dataSource as never);
  });

  it('ticks the task on the line, locking the entry and keeping the previous version as a revision', async () => {
    entryRepository.findOne.mockResolvedValue(entry());

    const result = await service.setTask(1, 4, { line: 1, checked: true });

    expect(entryRepository.findOne).toHaveBeenCalledWith({ where: { id: 4, userId: 1 }, lock: { mode: 'pessimistic_write' } });
    expect(revisionRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      entryId: 4,
      content: '- [ ] Call the bank\n- [ ] Post the letter',
      tags: ['errands'],
    }));
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ content: '- [ ] Call the bank\n- [x] Post the letter' }));
    expect(result.entry.content).toBe('- [ ] Call the bank\n- [x] Post the letter');
  });

  it('adds no revision when a recent one differs from the entry only in its ticks', async () => {
    const current = entry({ content: '- [x] Call the bank\n- [ ] Post the letter' });
    entryRepository.findOne.mockResolvedValue(current);
    revisionRepository.findOne.mockResolvedValue(revisionOf(entry(), new Date(Date.now() - 60_000)));

    await service.setTask(1, 4, { line: 1, checked: true });

    expect(revisionRepository.findOne).toHaveBeenCalledWith({ where: { entryId: 4 }, order: { createdAt: 'DESC', id: 'DESC' } });
    expect(revisionRepository.save).not.toHaveBeenCalled();
    expect(entryRepository.save).toHaveBeenCalledWith(expect.objectContaining({ content: '- [x] Call the bank\n- [x] Post the letter' }));
  });

  it('changes nothing when the task already has that state', async () => {
    const current = entry({ content: '- [x] Call the bank' });
    entryRepository.findOne.mockResolvedValue(current);

    const result = await service.setTask(1, 4, { line: 0, checked: true });

    expect(result).toEqual({ success: true, entry: current });
    expect(revisionRepository.save).not.toHaveBeenCalled();
    expect(entryRepository.save).not.toHaveBeenCalled();
  });

  it('refuses a missing entry, a plain-text entry, and a line that is no task', async () => {
    entryRepository.findOne.mockResolvedValueOnce(null);
    await expect(service.setTask(1, 4, { line: 0, checked: true })).rejects.toThrow(NotFoundException);

    entryRepository.findOne.mockResolvedValueOnce(entry({ format: 'plain' }));
    await expect(service.setTask(1, 4, { line: 0, checked: true })).rejects.toThrow(BadRequestException);

    entryRepository.findOne.mockResolvedValueOnce(entry());
    await expect(service.setTask(1, 4, { line: 5, checked: true })).rejects.toThrow(ConflictException);

    // A sealed time capsule cannot be ticked until it opens
    entryRepository.findOne.mockResolvedValueOnce(entry({ sealedUntil: new Date('2030-01-01T09:00:00Z') }));
    await expect(service.setTask(1, 4, { line: 0, checked: true })).rejects.toMatchObject({ response: { code: 'ENTRY_SEALED' } });

    expect(entryRepository.save).not.toHaveBeenCalled();
    expect(revisionRepository.save).not.toHaveBeenCalled();
  });
});

describe('revisionCoversTicks', () => {
  const now = new Date('2024-01-15T10:00:00Z');
  const current = {
    content: '- [x] One\n- [ ] Two',
    title: 'Errands',
    timeOfDay: null,
    mood: 3,
    feelings: ['calm'],
    tags: ['home'],
    date: '2024-01-15',
    format: 'markdown',
    visibility: 'private',
  } as unknown as Entry;
  const revision = (overrides: Partial<EntryRevision>, ageMs = 60_000) => ({
    ...current,
    content: '- [ ] One\n- [ ] Two',
    createdAt: new Date(now.getTime() - ageMs),
    ...overrides,
  }) as EntryRevision;

  it('covers ticks made within the window after a revision that differs only in ticks', () => {
    expect(revisionCoversTicks(revision({}), current, now)).toBe(true);
    expect(revisionCoversTicks(revision({}, TASK_REVISION_WINDOW_MS), current, now)).toBe(true);
  });

  it('keeps a new revision when there is none, it is older, or anything else changed since', () => {
    expect(revisionCoversTicks(null, current, now)).toBe(false);
    expect(revisionCoversTicks(revision({}, TASK_REVISION_WINDOW_MS + 1), current, now)).toBe(false);
    expect(revisionCoversTicks(revision({ content: '- [ ] One\n- [ ] Two\nMore' }), current, now)).toBe(false);
    expect(revisionCoversTicks(revision({ title: 'Other' }), current, now)).toBe(false);
    expect(revisionCoversTicks(revision({ mood: 4 }), current, now)).toBe(false);
    expect(revisionCoversTicks(revision({ feelings: [] }), current, now)).toBe(false);
    expect(revisionCoversTicks(revision({ tags: ['work'] }), current, now)).toBe(false);
    expect(revisionCoversTicks(revision({ date: '2024-01-14' }), current, now)).toBe(false);
    expect(revisionCoversTicks(revision({ visibility: 'public' }), current, now)).toBe(false);
  });
});
