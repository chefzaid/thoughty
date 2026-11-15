import { NotFoundException } from '@nestjs/common';
import { EntriesQueryService } from './entries-query.service';
import { createQueryBuilder } from './entries-query.test-helpers';

describe('EntriesQueryService', () => {
  let service: EntriesQueryService;
  let entryRepository: Record<string, jest.Mock>;
  let revisionRepository: Record<string, jest.Mock>;
  let timeCapsules: Record<string, jest.Mock>;
  let rereadReminders: Record<string, jest.Mock>;
  let personDates: Record<string, jest.Mock>;

  beforeEach(() => {
    entryRepository = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      query: jest.fn(),
    };

    revisionRepository = {
      find: jest.fn(),
    };

    timeCapsules = { findRecentlyOpened: jest.fn().mockResolvedValue([]) };
    rereadReminders = { findDue: jest.fn().mockResolvedValue([]) };
    personDates = { findOn: jest.fn().mockResolvedValue([]) };
    service = new EntriesQueryService(
      entryRepository as never,
      revisionRepository as never,
      timeCapsules as never,
      rereadReminders as never,
      personDates as never,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns available dates ordered descending', async () => {
    const qb = createQueryBuilder({
      getRawMany: jest.fn().mockResolvedValue([{ date: '2024-01-15' }, { date: '2024-01-10' }]),
    });
    entryRepository.createQueryBuilder.mockReturnValue(qb);

    await expect(service.getDates(2)).resolves.toEqual({ dates: ['2024-01-15', '2024-01-10'] });
    expect(qb.select).toHaveBeenCalledWith("DISTINCT TO_CHAR(e.date, 'YYYY-MM-DD')", 'date');
  });

  it('returns random and on-this-day highlights grouped by years ago', async () => {
    const diary = { name: 'Travel', icon: '✈️', color: '#2A9D8F' };
    const randomQb = createQueryBuilder({ getOne: jest.fn().mockResolvedValue({ id: 99, isFavorite: true, diary }) });
    const onThisDayQb = createQueryBuilder({
      getRawAndEntities: jest.fn().mockResolvedValue({
        raw: [{ entry_year: '2023' }, { entry_year: '2022' }],
        entities: [{ id: 1, diary }, { id: 2, diary: null }],
      }),
    });
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(randomQb)
      .mockReturnValueOnce(onThisDayQb);

    const now = new Date('2024-01-15T12:00:00Z');

    const result = await service.getHighlights(7, { diaryId: 3 }, now);

    expect(randomQb.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 3 });
    expect(onThisDayQb.andWhere).toHaveBeenCalledWith('e.diary_id = :diaryId', { diaryId: 3 });
    // Sent like every other entry: snake_case, with the diary the web shows on each card
    expect(result.randomEntry).toEqual(
      expect.objectContaining({ id: 99, is_favorite: true, diary_name: 'Travel', diary_icon: '✈️', diary_color: '#2A9D8F' }),
    );
    expect(result.randomEntry).not.toHaveProperty('diary');
    expect(result.onThisDay).toEqual({
      1: [expect.objectContaining({ id: 1, diary_name: 'Travel' })],
      2: [expect.objectContaining({ id: 2, diary_name: undefined })],
    });
    expect(result.currentDate).toEqual({ month: '01', day: '15', year: 2024 });
    expect(randomQb.andWhere).toHaveBeenCalledWith('e.sealed_until IS NULL');
    expect(onThisDayQb.andWhere).toHaveBeenCalledWith('e.sealed_until IS NULL');
    expect(timeCapsules.findRecentlyOpened).toHaveBeenCalledWith(7, 3, now);
    expect(result.openedCapsules).toEqual([]);
    // Without the writer's day, On This Day and reminders go by the server's UTC day
    expect(onThisDayQb.andWhere).toHaveBeenCalledWith("TO_CHAR(e.date, 'MM-DD') = :mmdd", { mmdd: '01-15' });
    expect(rereadReminders.findDue).toHaveBeenCalledWith(7, 3, '2024-01-15');
    expect(result.rereadReminders).toEqual([]);
    // People are the writer's, not a diary's: their dates are found by the day alone
    expect(personDates.findOn).toHaveBeenCalledWith(7, '2024-01-15');
    expect(result.personDates).toEqual([]);
  });

  it.each([
    // 10:30 UTC on 31 October is 00:30 on 1 November in Kiritimati (UTC+14) and 23:30 on 30 October in Pago Pago (UTC-11)
    ['Pacific/Kiritimati', '2026-10-31T10:30:00Z', '2026-11-01', '11-01', { month: '11', day: '01', year: 2026 }],
    ['Pacific/Pago_Pago', '2026-10-31T10:30:00Z', '2026-10-30', '10-30', { month: '10', day: '30', year: 2026 }],
    // New Year's Day in Kiritimati while it is still the last day of the year in UTC: last year's entries are a year ago
    ['Pacific/Kiritimati', '2026-12-31T10:30:00Z', '2027-01-01', '01-01', { month: '01', day: '01', year: 2027 }],
    ['Pacific/Pago_Pago', '2027-01-01T10:30:00Z', '2026-12-31', '12-31', { month: '12', day: '31', year: 2026 }],
  ])('shows On This Day for the writer’s own day in %s at %s', async (_zone, at, today, mmdd, currentDate) => {
    const onThisDayQb = createQueryBuilder({
      getRawAndEntities: jest.fn().mockResolvedValue({ raw: [{ entry_year: '2025' }], entities: [{ id: 4, diary: null }] }),
    });
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(createQueryBuilder({ getOne: jest.fn().mockResolvedValue(null) }))
      .mockReturnValueOnce(onThisDayQb);

    const result = await service.getHighlights(7, { today }, new Date(at));

    expect(onThisDayQb.andWhere).toHaveBeenCalledWith("TO_CHAR(e.date, 'MM-DD') = :mmdd", { mmdd });
    expect(onThisDayQb.andWhere).toHaveBeenCalledWith('EXTRACT(YEAR FROM e.date) < :currentYear', { currentYear: currentDate.year });
    expect(result.currentDate).toEqual(currentDate);
    expect(result.onThisDay).toEqual({ [currentDate.year - 2025]: [expect.objectContaining({ id: 4 })] });
    expect(rereadReminders.findDue).toHaveBeenCalledWith(7, undefined, today);
    expect(personDates.findOn).toHaveBeenCalledWith(7, today);
  });

  it('shows the birthdays and anniversaries of the day with the newest entry about each person', async () => {
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(createQueryBuilder({ getOne: jest.fn().mockResolvedValue(null) }))
      .mockReturnValueOnce(createQueryBuilder({ getRawAndEntities: jest.fn().mockResolvedValue({ raw: [], entities: [] }) }));
    const date = { kind: 'birthday', month: 3, day: 14, year: 1992 };
    personDates.findOn.mockResolvedValue([
      { id: 12, name: 'Marie', date, years: 34, entryCount: 2, latestEntry: { id: 21, date: '2026-03-01', content: 'Tea with @Marie', tags: [], sealedUntil: null } },
      { id: 13, name: 'Paul', date: { ...date, kind: 'anniversary', year: null }, years: null, entryCount: 0, latestEntry: null },
    ]);

    const result = await service.getHighlights(7, { today: '2026-03-14' });

    expect(result.personDates).toEqual([
      { id: 12, name: 'Marie', date, years: 34, entryCount: 2, latestEntry: expect.objectContaining({ id: 21, content: 'Tea with @Marie' }) },
      { id: 13, name: 'Paul', date: { ...date, kind: 'anniversary', year: null }, years: null, entryCount: 0, latestEntry: null },
    ]);
  });

  it('shows the entries the writer asked to reread by their own day', async () => {
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(createQueryBuilder({ getOne: jest.fn().mockResolvedValue(null) }))
      .mockReturnValueOnce(createQueryBuilder({ getRawAndEntities: jest.fn().mockResolvedValue({ raw: [], entities: [] }) }));
    rereadReminders.findDue.mockResolvedValue([
      { id: 21, date: '2025-05-01', content: 'The day we moved', tags: [], rereadOn: '2026-10-30', sealedUntil: null },
    ]);

    const result = await service.getHighlights(7, { today: '2026-10-31' });

    expect(rereadReminders.findDue).toHaveBeenCalledWith(7, undefined, '2026-10-31');
    expect(result.rereadReminders).toEqual([
      expect.objectContaining({ id: 21, content: 'The day we moved', reread_on: '2026-10-30' }),
    ]);
  });

  it('shows the capsules opened lately, saying when they were sealed and whether they opened early', async () => {
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(createQueryBuilder({ getOne: jest.fn().mockResolvedValue(null) }))
      .mockReturnValueOnce(createQueryBuilder({ getRawAndEntities: jest.fn().mockResolvedValue({ raw: [], entities: [] }) }));
    const sealedAt = new Date('2025-10-27T09:00:00Z');
    const entry = { id: 12, content: 'Dear future me', tags: [], sealedUntil: null };
    timeCapsules.findRecentlyOpened.mockResolvedValue([
      { entry, createdAt: sealedAt, openAt: new Date('2026-10-27T07:00:00Z'), openedAt: new Date('2026-10-27T07:00:30Z') },
      { entry: { ...entry, id: 13 }, createdAt: sealedAt, openAt: new Date('2030-01-01T08:00:00Z'), openedAt: new Date('2026-10-26T20:00:00Z') },
    ]);

    const result = await service.getHighlights(7, {});

    expect(result.openedCapsules).toEqual([
      { entry: expect.objectContaining({ id: 12, content: 'Dear future me' }), sealed_at: sealedAt, opened_at: new Date('2026-10-27T07:00:30Z'), opened_early: false },
      { entry: expect.objectContaining({ id: 13 }), sealed_at: sealedAt, opened_at: new Date('2026-10-26T20:00:00Z'), opened_early: true },
    ]);
  });

  it('shows no history for a sealed time capsule', async () => {
    entryRepository.findOne.mockResolvedValueOnce({ id: 8, userId: 2, sealedUntil: new Date('2030-01-01T08:00:00Z') });

    await expect(service.getRevisions(2, 8)).resolves.toEqual([]);
    expect(revisionRepository.find).not.toHaveBeenCalled();
  });

  it('answers no random entry and no earlier years when the journal is empty', async () => {
    entryRepository.createQueryBuilder
      .mockReturnValueOnce(createQueryBuilder({ getOne: jest.fn().mockResolvedValue(null) }))
      .mockReturnValueOnce(createQueryBuilder({ getRawAndEntities: jest.fn().mockResolvedValue({ raw: [], entities: [] }) }));

    const result = await service.getHighlights(7, {});

    expect(result.randomEntry).toBeNull();
    expect(result.onThisDay).toEqual({});
  });

  it('returns revisions ordered by date and throws when the entry is missing', async () => {
    entryRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 8, userId: 2 });
    revisionRepository.find.mockResolvedValue([{ id: 5 }]);

    await expect(service.getRevisions(2, 8)).rejects.toThrow(NotFoundException);
    await expect(service.getRevisions(2, 8)).resolves.toEqual([{ id: 5 }]);
    expect(revisionRepository.find).toHaveBeenCalledWith({
      where: { entryId: 8, userId: 2 },
      order: { createdAt: 'DESC' },
    });
  });

  it('lists user-scoped tag usage counts outside the recycle bin', async () => {
    entryRepository.query.mockResolvedValue([
      { tag: 'focus', count: '3' },
      { tag: 'work', count: 1 },
    ]);

    await expect(service.getTagUsage(4)).resolves.toEqual({
      tags: [
        { tag: 'focus', count: 3 },
        { tag: 'work', count: 1 },
      ],
    });
    expect(entryRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE e.user_id = $1 AND e.deleted_at IS NULL'),
      [4],
    );
  });
});
