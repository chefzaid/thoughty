import { Entry, TimeCapsule } from '@/database/entities';
import { OPENED_CAPSULE_HIGHLIGHT_DAYS, TimeCapsuleService } from './time-capsules.service';

describe('TimeCapsuleService', () => {
  const now = new Date('2026-10-27T10:00:00Z');
  let entries: Record<string, jest.Mock>;
  let capsules: Record<string, jest.Mock>;
  let manager: { getRepository: jest.Mock; query: jest.Mock };
  let capsuleRepository: Record<string, jest.Mock>;
  let service: TimeCapsuleService;

  const sealedCapsule = (overrides: Partial<TimeCapsule> = {}) =>
    ({
      id: 4,
      entryId: 12,
      userId: 3,
      openAt: new Date('2027-10-27T07:00:00Z'),
      sealedTitle: 'Dear future me',
      sealedContent: 'Remember @Marie and the harbor.',
      sealedTags: ['future-self'],
      sealedMood: 4,
      sealedFeelings: ['hopeful'],
      openedAt: null,
      createdAt: new Date('2026-10-27T09:00:00Z'),
      ...overrides,
    }) as TimeCapsule;

  beforeEach(() => {
    entries = {
      save: jest.fn(async (value: object) => ({ id: 12, ...value })),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
    };
    capsules = { insert: jest.fn(), findOne: jest.fn(), update: jest.fn() };
    manager = {
      getRepository: jest.fn((target: unknown) => (target === Entry ? entries : capsules)),
      // Linking mentions: no people yet, so @Marie becomes person 8
      query: jest.fn(async (sql: string) => {
        if (sql.includes('COUNT(*)')) return [{ count: 0 }];
        if (sql.includes('INSERT INTO people')) return [{ handle: 'marie', personId: 8 }];
        return [];
      }),
    };
    capsuleRepository = { find: jest.fn(), createQueryBuilder: jest.fn() };
    const entryRepository = { manager: { transaction: jest.fn((work: (m: unknown) => unknown) => work(manager)) } };
    service = new TimeCapsuleService(capsuleRepository as never, entryRepository as never);
  });

  describe('createSealed', () => {
    const written = {
      date: '2026-10-27',
      index: 1,
      title: 'Dear future me',
      timeOfDay: '08:30',
      content: 'What I want you to remember.',
      tags: ['future-self'],
      mood: 4,
      feelings: ['hopeful'],
      format: 'plain' as const,
      visibility: 'public' as const,
      diaryId: 2,
    };

    it('saves an empty, private entry and keeps what was written in the capsule', async () => {
      const entry = await service.createSealed(3, written, { opensOn: '2027-10-27', timeZone: 'Europe/Paris' }, now);

      const openAt = new Date('2027-10-27T07:00:00Z');
      expect(entries.save).toHaveBeenCalledWith({
        ...written,
        userId: 3,
        title: null,
        content: '',
        tags: [],
        mood: null,
        feelings: [],
        visibility: 'private',
        sealedUntil: openAt,
      });
      expect(capsules.insert).toHaveBeenCalledWith({
        entryId: 12,
        userId: 3,
        opensOn: '2027-10-27',
        openHour: 9,
        timeZone: 'Europe/Paris',
        openAt,
        sealedTitle: 'Dear future me',
        sealedContent: 'What I want you to remember.',
        sealedTags: ['future-self'],
        sealedMood: 4,
        sealedFeelings: ['hopeful'],
      });
      expect(entry).toMatchObject({ id: 12, content: '', sealedUntil: openAt });
    });

    it('keeps an entry without details as empty details', async () => {
      await service.createSealed(3, { date: '2026-10-27', content: 'Only text' }, { opensOn: '2027-01-01', openHour: 0, timeZone: 'UTC' }, now);

      expect(capsules.insert).toHaveBeenCalledWith(expect.objectContaining({
        sealedTitle: null, sealedContent: 'Only text', sealedTags: [], sealedMood: null, sealedFeelings: [], openHour: 0,
      }));
    });

    it('refuses a date outside tomorrow to fifty years ahead, or an unknown zone, before saving', async () => {
      await expect(service.createSealed(3, written, { opensOn: '2026-10-27', timeZone: 'UTC' }, now)).rejects.toMatchObject({
        response: { code: 'TIME_CAPSULE_DATE_INVALID', statusCode: 400 },
      });
      await expect(service.createSealed(3, written, { opensOn: '2027-10-27', timeZone: 'Nowhere/City' }, now)).rejects.toMatchObject({
        response: { code: 'VALIDATION_FAILED', message: 'Unknown time zone' },
      });
      expect(entries.save).not.toHaveBeenCalled();
    });
  });

  describe('opening', () => {
    it('moves the sealed copy back, keeps tags added since, relinks mentions and clears the copy', async () => {
      entries.findOneOrFail.mockResolvedValue({ id: 12, userId: 3, content: '', title: null, tags: ['later'], sealedUntil: new Date() });

      const opened = await service.openCapsule(manager as never, sealedCapsule(), now);

      expect(entries.findOneOrFail).toHaveBeenCalledWith({ where: { id: 12 }, withDeleted: true });
      expect(opened).toMatchObject({
        title: 'Dear future me',
        content: 'Remember @Marie and the harbor.',
        tags: ['future-self', 'later'],
        mood: 4,
        feelings: ['hopeful'],
        sealedUntil: null,
      });
      expect(manager.query).toHaveBeenCalledWith('DELETE FROM entry_people WHERE entry_id = ANY($1::int[])', [[12]]);
      expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO entry_people'), [[12], [8]]);
      expect(capsules.update).toHaveBeenCalledWith(4, {
        openedAt: now, sealedTitle: null, sealedContent: null, sealedTags: [], sealedMood: null, sealedFeelings: [],
      });
    });

    it('opens one of the writer’s sealed entries early under a row lock', async () => {
      entries.findOne.mockResolvedValue({ id: 12, userId: 3, sealedUntil: new Date('2027-10-27T07:00:00Z') });
      entries.findOneOrFail.mockResolvedValue({ id: 12, userId: 3, content: '', tags: [] });
      capsules.findOne.mockResolvedValue(sealedCapsule());

      await expect(service.openEarly(3, 12, now)).resolves.toMatchObject({ content: 'Remember @Marie and the harbor.' });
      expect(entries.findOne).toHaveBeenCalledWith({ where: { id: 12, userId: 3 } });
      expect(capsules.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
    });

    it('answers not found for someone else’s entry and conflict for an entry that is not sealed', async () => {
      entries.findOne.mockResolvedValue(null);
      await expect(service.openEarly(3, 12, now)).rejects.toMatchObject({ response: { code: 'ENTRY_NOT_FOUND' } });

      entries.findOne.mockResolvedValue({ id: 12, userId: 3, sealedUntil: null });
      capsules.findOne.mockResolvedValue(null);
      await expect(service.openEarly(3, 12, now)).rejects.toMatchObject({ response: { code: 'ENTRY_NOT_SEALED', statusCode: 409 } });

      entries.findOne.mockResolvedValue({ id: 12, userId: 3, sealedUntil: new Date() });
      await expect(service.openEarly(3, 12, now)).rejects.toMatchObject({ response: { code: 'ENTRY_NOT_SEALED' } });
    });
  });

  describe('reveal', () => {
    it('gives sealed entries their sealed copy back for exports and leaves the others alone', async () => {
      const sealedUntil = new Date('2027-10-27T07:00:00Z');
      const open = { id: 1, content: 'Open', tags: ['a'], sealedUntil: null } as unknown as Entry;
      const sealed = { id: 12, content: '', tags: [], title: null, sealedUntil } as unknown as Entry;
      const orphan = { id: 13, content: '', tags: [], sealedUntil } as unknown as Entry;
      capsuleRepository.find.mockResolvedValue([sealedCapsule()]);

      await expect(service.reveal([open, sealed, orphan])).resolves.toEqual([
        open,
        { ...sealed, title: 'Dear future me', content: 'Remember @Marie and the harbor.', tags: ['future-self'], mood: 4, feelings: ['hopeful'] },
        orphan,
      ]);
      expect(capsuleRepository.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ entryId: expect.anything() }) }));
    });

    it('reads nothing when no entry is sealed', async () => {
      const open = [{ id: 1, sealedUntil: null } as unknown as Entry];
      await expect(service.reveal(open)).resolves.toBe(open);
      expect(capsuleRepository.find).not.toHaveBeenCalled();
    });
  });

  it('finds the capsules opened in the last week, live entries only, in one diary or all', async () => {
    const qb: Record<string, jest.Mock> = {};
    for (const method of ['innerJoinAndSelect', 'leftJoinAndSelect', 'where', 'andWhere', 'orderBy', 'limit']) {
      qb[method] = jest.fn(() => qb);
    }
    qb.getMany = jest.fn().mockResolvedValue(['capsule']);
    capsuleRepository.createQueryBuilder.mockReturnValue(qb);

    await expect(service.findRecentlyOpened(3, 2, now)).resolves.toEqual(['capsule']);
    expect(qb.innerJoinAndSelect).toHaveBeenCalledWith('tc.entry', 'e', 'e.deleted_at IS NULL');
    expect(qb.andWhere).toHaveBeenCalledWith('tc.opened_at >= :since', {
      since: new Date(now.getTime() - OPENED_CAPSULE_HIGHLIGHT_DAYS * 24 * 60 * 60 * 1000),
    });
    expect(qb.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 2 });

    qb.andWhere.mockClear();
    await service.findRecentlyOpened(3, undefined, now);
    expect(qb.andWhere).not.toHaveBeenCalledWith('e.diary_id = :diaryId', expect.anything());
  });
});
