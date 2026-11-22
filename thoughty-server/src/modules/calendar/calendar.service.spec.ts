import { BadRequestException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import type { CalendarEvent } from '@/database/entities';
import { CALENDAR_EVENT_LIMIT } from './dto';
import { CalendarService } from './calendar.service';

const createdAt = new Date('2026-11-21T09:00:00Z');
const dinner = {
  id: 5,
  userId: 7,
  uid: 'dinner@example',
  summary: 'Dinner',
  location: 'Lyon',
  allDay: false,
  startsAt: new Date('2026-11-22T19:30:00Z'),
  endsAt: new Date('2026-11-22T22:00:00Z'),
  startDate: null,
  endDate: null,
  recurrence: null,
  createdAt,
  updatedAt: createdAt,
} as CalendarEvent;

/** A yearly all-day event and a weekly one at 9:00 UTC, both repeating on 22 November 2026 (a Sunday). */
const birthday = {
  ...dinner,
  id: 6,
  uid: 'birthday@example',
  summary: 'birthday',
  location: null,
  allDay: true,
  startsAt: null,
  endsAt: null,
  startDate: '1990-11-22',
  endDate: '1990-11-22',
  recurrence: { rule: { freq: 'YEARLY', interval: 1, weekStart: 1 }, until: null, rdates: [], exdates: [], timeZone: 'UTC' },
} as CalendarEvent;
const run = {
  ...dinner,
  id: 7,
  uid: 'run@example',
  summary: 'Run',
  location: null,
  startsAt: new Date('2026-11-01T09:00:00Z'),
  endsAt: new Date('2026-11-01T10:00:00Z'),
  recurrence: { rule: { freq: 'WEEKLY', interval: 1, weekStart: 1 }, until: null, rdates: [], exdates: [], timeZone: 'UTC' },
} as CalendarEvent;

const file = (text: string) => ({ buffer: Buffer.from(text) }) as Express.Multer.File;
const ics = (events: number) => [
  'BEGIN:VCALENDAR',
  ...Array.from({ length: events }, (_, index) => [`BEGIN:VEVENT`, `UID:e${index}`, 'DTSTART:20261122T120000Z', 'END:VEVENT']).flat(),
  'BEGIN:VEVENT', 'UID:hourly', 'DTSTART:20261122T120000Z', 'RRULE:FREQ=HOURLY', 'END:VEVENT',
  'END:VCALENDAR',
].join('\n');

describe('CalendarService', () => {
  let repository: Record<string, jest.Mock> & { manager?: unknown };
  let queryBuilder: Record<string, jest.Mock>;
  let manager: { query: jest.Mock; getRepository: jest.Mock };
  let service: CalendarService;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    repository = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      query: jest.fn().mockResolvedValue([{ eventCount: 0, lastImportedAt: null }]),
      upsert: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
      delete: jest.fn().mockResolvedValue({ affected: 3 }),
    };
    manager = { query: jest.fn().mockResolvedValue([]), getRepository: jest.fn(() => repository) };
    repository.manager = { transaction: jest.fn((work) => work(manager)) };
    service = new CalendarService(repository as never);
  });

  it('sums up the imported events with the limit', async () => {
    repository.query.mockResolvedValue([{ eventCount: 12, lastImportedAt: createdAt }]);

    await expect(service.summary(7)).resolves.toEqual({ eventCount: 12, lastImportedAt: createdAt, limit: CALENDAR_EVENT_LIMIT });
    expect(repository.query).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = $1'), [7]);
  });

  it('lists a day’s events in the writer’s zone, all-day first, at most 50, and UTC without a zone', async () => {
    queryBuilder.getMany.mockResolvedValueOnce([dinner]).mockResolvedValueOnce([]);

    await expect(service.eventsOn(7, '2026-11-22', 'Europe/Paris')).resolves.toEqual({
      events: [{ id: 5, summary: 'Dinner', location: 'Lyon', allDay: false, startsAt: dinner.startsAt, endsAt: dinner.endsAt, startDate: null, endDate: null, repeats: false }],
    });
    expect(queryBuilder.where).toHaveBeenCalledWith('event.user_id = :userId', { userId: 7 });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('event.recurrence IS NULL');
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('event.recurrence IS NOT NULL');
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(expect.stringContaining('AT TIME ZONE :timeZone'), { date: '2026-11-22', timeZone: 'Europe/Paris' });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('event.all_day', 'DESC');
    expect(queryBuilder.limit).toHaveBeenCalledWith(50);

    await service.eventsOn(7, '2026-11-22');
    expect(queryBuilder.andWhere).toHaveBeenLastCalledWith(expect.any(String), { date: '2026-11-22', timeZone: 'UTC' });
  });

  it('lists the day’s occurrence of each repeating event among the others, in the same order', async () => {
    const lateRun = { ...run, id: 8, summary: 'run', startsAt: new Date('2026-11-01T09:00:00Z') } as CalendarEvent;
    const notToday = { ...run, id: 9, startsAt: new Date('2026-11-02T09:00:00Z'), endsAt: new Date('2026-11-02T10:00:00Z') } as CalendarEvent;
    const market = { ...birthday, id: 4, summary: 'Market', recurrence: null, startDate: '2026-11-22', endDate: '2026-11-22' } as CalendarEvent;
    const zoo = { ...market, id: 3, summary: 'Zoo' } as CalendarEvent;
    queryBuilder.getMany.mockResolvedValueOnce([zoo, market, dinner]).mockResolvedValueOnce([lateRun, notToday, run, birthday]);

    const { events } = await service.eventsOn(7, '2026-11-22');

    // All day by title (case aside), then by start, then by id
    expect(events.map(({ id, repeats }) => [id, repeats])).toEqual([[6, true], [4, false], [3, false], [7, true], [8, true], [5, false]]);
    expect(events[0]).toMatchObject({ allDay: true, startDate: '2026-11-22', endDate: '2026-11-22', startsAt: null });
    expect(events[3]).toMatchObject({ startsAt: new Date('2026-11-22T09:00:00Z'), endsAt: new Date('2026-11-22T10:00:00Z'), startDate: null });
  });

  it('keeps at most 50 events on a day with repeating ones', async () => {
    const oneOff = Array.from({ length: 50 }, (_, index) => ({ ...dinner, id: 100 + index }));
    queryBuilder.getMany.mockResolvedValueOnce(oneOff).mockResolvedValueOnce([birthday]);

    const { events } = await service.eventsOn(7, '2026-11-22');

    expect(events).toHaveLength(50);
    expect(events[0].id).toBe(6);
    expect(events[49].id).toBe(148);
  });

  it('imports a file’s events by UID under the writer’s lock, counting the repeating ones it cannot read', async () => {
    repository.count.mockResolvedValue(40);

    await expect(service.import(7, file(ics(2)), 'Europe/Paris')).resolves.toEqual({ imported: 2, skippedRecurring: 1, eventCount: 40 });
    expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1), $2)', ['calendar_events', 7]);
    expect(repository.upsert).toHaveBeenCalledTimes(1);
    const [rows, conflict] = repository.upsert.mock.calls[0];
    expect(conflict).toEqual(['userId', 'uid']);
    expect(rows).toEqual([
      expect.objectContaining({ userId: 7, uid: 'e0', allDay: false, startsAt: new Date('2026-11-22T12:00:00Z'), startDate: null, endDate: null, recurrence: null, updatedAt: expect.any(Date) }),
      expect.objectContaining({ uid: 'e1' }),
    ]);
  });

  it('writes a large file 500 events at a time, and stores an all-day event by its days', async () => {
    await service.import(7, file(ics(1001)));
    expect(repository.upsert.mock.calls.map(([rows]) => rows.length)).toEqual([500, 500, 1]);

    repository.upsert.mockClear();
    await service.import(7, file('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:day\nDTSTART;VALUE=DATE:20261225\nEND:VEVENT\nEND:VCALENDAR'));
    expect(repository.upsert.mock.calls[0][0]).toEqual([
      expect.objectContaining({ uid: 'day', allDay: true, startsAt: null, endsAt: null, startDate: '2026-12-25', endDate: '2026-12-25' }),
    ]);
  });

  it('stores how a repeating event repeats', async () => {
    await service.import(7, file('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:xmas\nDTSTART;VALUE=DATE:20261225\nRRULE:FREQ=YEARLY\nEND:VEVENT\nEND:VCALENDAR'));
    expect(repository.upsert.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        uid: 'xmas',
        startDate: '2026-12-25',
        recurrence: { rule: { freq: 'YEARLY', interval: 1, weekStart: 1 }, until: null, rdates: [], exdates: [], timeZone: 'UTC' },
      }),
    ]);
  });

  it('refuses a missing file or one that is not a calendar', async () => {
    await expectApiError(service.import(7, undefined), BadRequestException, 'CALENDAR_FILE_INVALID');
    await expectApiError(service.import(7, file('not a calendar')), BadRequestException, 'CALENDAR_FILE_INVALID');
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it('refuses an import that would pass the limit, so the transaction writes nothing', async () => {
    repository.count.mockResolvedValue(CALENDAR_EVENT_LIMIT + 1);

    await expectApiError(service.import(7, file(ics(1))), BadRequestException, 'CALENDAR_EVENT_LIMIT_REACHED');
  });

  it('removes every imported event of the writer', async () => {
    await expect(service.clear(7)).resolves.toEqual({ success: true });
    expect(repository.delete).toHaveBeenCalledWith({ userId: 7 });
  });
});
