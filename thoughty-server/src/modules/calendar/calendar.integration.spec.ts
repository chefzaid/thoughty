import { BadRequestException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { CalendarEvent, User } from '@/database/entities';
import { CalendarService } from './calendar.service';
import * as dto from './dto/calendar.dto';

const file = (...events: string[][]) => ({
  buffer: Buffer.from(['BEGIN:VCALENDAR', ...events.flatMap((lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n')),
}) as Express.Multer.File;

describePostgres('PostgreSQL imported calendar events', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let service: CalendarService;
  let writerId: number;
  let otherId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    service = new CalendarService(dataSource.getRepository(CalendarEvent));
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
  });

  const summaries = async (userId: number, date: string, timeZone?: string) =>
    (await service.eventsOn(userId, date, timeZone)).events.map((event) => event.summary);

  it('lists each day’s events in the writer’s zone, all-day first, then by start', async () => {
    await service.import(writerId, file(
      ['UID:late', 'SUMMARY:Late dinner', 'DTSTART:20261122T231500Z', 'DTEND:20261122T234500Z'],
      ['UID:morning', 'SUMMARY:Dentist', 'DTSTART:20261122T083000Z', 'DTEND:20261122T091500Z'],
      ['UID:trip', 'SUMMARY:Trip to Lyon', 'DTSTART;VALUE=DATE:20261121', 'DTEND;VALUE=DATE:20261124'],
      ['UID:night', 'SUMMARY:Night train', 'DTSTART:20261121T220000Z', 'DTEND:20261122T060000Z'],
      ['UID:instant', 'SUMMARY:Reminder', 'DTSTART:20261123T000000Z'],
    ));

    await expect(summaries(writerId, '2026-11-22')).resolves.toEqual(['Trip to Lyon', 'Night train', 'Dentist', 'Late dinner']);
    // In Paris (UTC+1) the late dinner is already past midnight, on the 23rd with the reminder at one in the morning
    await expect(summaries(writerId, '2026-11-22', 'Europe/Paris')).resolves.toEqual(['Trip to Lyon', 'Night train', 'Dentist']);
    await expect(summaries(writerId, '2026-11-23', 'Europe/Paris')).resolves.toEqual(['Trip to Lyon', 'Late dinner', 'Reminder']);
    await expect(summaries(writerId, '2026-11-24')).resolves.toEqual([]);
    await expect(summaries(otherId, '2026-11-22')).resolves.toEqual([]);
  });

  it('updates the events of a file imported again by UID, keeps other files’ events, and sums them up', async () => {
    const first = await service.import(writerId, file(
      ['UID:a', 'SUMMARY:Concert', 'DTSTART:20261122T190000Z'],
      ['UID:hourly', 'SUMMARY:Stretch', 'DTSTART:20261122T070000Z', 'RRULE:FREQ=HOURLY'],
    ));
    expect(first).toEqual({ imported: 1, skippedRecurring: 1, eventCount: 1 });
    await service.import(writerId, file(['UID:b', 'SUMMARY:Market', 'DTSTART;VALUE=DATE:20261122']));

    const again = await service.import(writerId, file(['UID:a', 'SUMMARY:Concert (moved)', 'DTSTART:20261122T200000Z', 'LOCATION:Opera']));
    expect(again).toEqual({ imported: 1, skippedRecurring: 0, eventCount: 2 });
    const day = await service.eventsOn(writerId, '2026-11-22');
    expect(day.events).toEqual([
      expect.objectContaining({ summary: 'Market', allDay: true, startDate: '2026-11-22', endDate: '2026-11-22', startsAt: null }),
      expect.objectContaining({ summary: 'Concert (moved)', location: 'Opera', allDay: false, startsAt: new Date('2026-11-22T20:00:00Z') }),
    ]);

    const summary = await service.summary(writerId);
    expect(summary).toEqual({ eventCount: 2, lastImportedAt: expect.any(Date), limit: dto.CALENDAR_EVENT_LIMIT });
    await expect(service.summary(otherId)).resolves.toEqual({ eventCount: 0, lastImportedAt: null, limit: dto.CALENDAR_EVENT_LIMIT });
  });

  it('lists a repeating event on each day it falls on, with its changed and cancelled occurrences', async () => {
    const result = await service.import(writerId, file(
      [
        'UID:yoga', 'SUMMARY:Yoga', 'DTSTART;TZID=Europe/Paris:20261102T190000', 'DTEND;TZID=Europe/Paris:20261102T200000',
        'RRULE:FREQ=WEEKLY;COUNT=6', 'EXDATE;TZID=Europe/Paris:20261116T190000',
      ],
      ['UID:yoga', 'SUMMARY:Yoga (Tuesday)', 'DTSTART;TZID=Europe/Paris:20261110T190000', 'DTEND;TZID=Europe/Paris:20261110T200000', 'RECURRENCE-ID;TZID=Europe/Paris:20261109T190000'],
      ['UID:yoga', 'STATUS:CANCELLED', 'DTSTART;TZID=Europe/Paris:20261130T190000', 'RECURRENCE-ID;TZID=Europe/Paris:20261130T190000'],
      ['UID:birthday', 'SUMMARY:Lina’s birthday', 'DTSTART;VALUE=DATE:19901123', 'RRULE:FREQ=YEARLY'],
      ['UID:later', 'SUMMARY:Later', 'DTSTART;VALUE=DATE:20270101', 'RRULE:FREQ=DAILY'],
    ), 'Europe/Paris');
    expect(result).toEqual({ imported: 4, skippedRecurring: 0, eventCount: 4 });

    const day = async (date: string) => (await service.eventsOn(writerId, date, 'Europe/Paris')).events;
    await expect(day('2026-11-23')).resolves.toEqual([
      expect.objectContaining({ summary: 'Lina’s birthday', allDay: true, startDate: '2026-11-23', endDate: '2026-11-23', repeats: true }),
      expect.objectContaining({ summary: 'Yoga', startsAt: new Date('2026-11-23T18:00:00Z'), endsAt: new Date('2026-11-23T19:00:00Z'), repeats: true }),
    ]);
    await expect(day('2026-11-10')).resolves.toEqual([expect.objectContaining({ summary: 'Yoga (Tuesday)', repeats: false })]);
    await expect(day('2026-11-09')).resolves.toEqual([]);
    await expect(day('2026-11-16')).resolves.toEqual([]);
    await expect(day('2026-11-30')).resolves.toEqual([]);
    // The sixth and last, counting the moved and the removed ones
    await expect(day('2026-12-07')).resolves.toEqual([expect.objectContaining({ summary: 'Yoga' })]);
    await expect(day('2026-12-14')).resolves.toEqual([]);
    await expect(summaries(writerId, '2027-11-23')).resolves.toEqual(['Later', 'Lina’s birthday']);
  });

  it('lists several days at once as it lists each, leaving out the days without events', async () => {
    await service.import(writerId, file(
      ['UID:late', 'SUMMARY:Late dinner', 'DTSTART:20261122T231500Z', 'DTEND:20261122T234500Z'],
      ['UID:trip', 'SUMMARY:Trip to Lyon', 'DTSTART;VALUE=DATE:20261121', 'DTEND;VALUE=DATE:20261124'],
      ['UID:night', 'SUMMARY:Night train', 'DTSTART:20261121T220000Z', 'DTEND:20261122T060000Z'],
      ['UID:yoga', 'SUMMARY:Yoga', 'DTSTART;TZID=Europe/Paris:20261102T190000', 'DTEND;TZID=Europe/Paris:20261102T200000', 'RRULE:FREQ=WEEKLY'],
      ['UID:birthday', 'SUMMARY:Lina’s birthday', 'DTSTART;VALUE=DATE:19901123', 'RRULE:FREQ=YEARLY'],
    ), 'Europe/Paris');
    await service.import(otherId, file(['UID:other', 'SUMMARY:Not mine', 'DTSTART;VALUE=DATE:20261122']));
    const dates = ['2026-11-23', '2026-11-20', '2026-11-22', '2026-11-30', '2026-11-22', '2026-11-21'];

    const { days } = await service.eventsOnDays(writerId, dates, 'Europe/Paris');

    expect(days.map((day) => day.date)).toEqual(['2026-11-21', '2026-11-22', '2026-11-23', '2026-11-30']);
    for (const day of days) {
      expect(day.events).toEqual((await service.eventsOn(writerId, day.date, 'Europe/Paris')).events);
    }
    expect(days.map((day) => day.events.map((event) => event.summary))).toEqual([
      ['Trip to Lyon', 'Night train'],
      ['Trip to Lyon', 'Night train'],
      ['Lina’s birthday', 'Trip to Lyon', 'Late dinner', 'Yoga'],
      ['Yoga'],
    ]);
    await expect(service.eventsOnDays(writerId, ['2026-11-20'], 'Europe/Paris')).resolves.toEqual({ days: [] });
    await expect(service.eventsOnDays(otherId, dates)).resolves.toEqual({ days: [{ date: '2026-11-22', events: [expect.objectContaining({ summary: 'Not mine' })] }] });
  });

  it('refuses an import past the limit and keeps what was there', async () => {
    const limit = jest.replaceProperty(dto, 'CALENDAR_EVENT_LIMIT', 2 as never);
    try {
      await service.import(writerId, file(['UID:a', 'DTSTART:20261122T190000Z']));
      await expectApiError(
        service.import(writerId, file(['UID:b', 'DTSTART:20261122T190000Z'], ['UID:c', 'DTSTART:20261122T190000Z'])),
        BadRequestException,
        'CALENDAR_EVENT_LIMIT_REACHED',
      );
    } finally {
      limit.restore();
    }
    await expect(service.summary(writerId)).resolves.toMatchObject({ eventCount: 1 });
  });

  it('removes only the writer’s events, and they go with the account', async () => {
    await service.import(writerId, file(['UID:a', 'DTSTART:20261122T190000Z']));
    await service.import(otherId, file(['UID:a', 'DTSTART:20261122T190000Z']));

    await expect(service.clear(writerId)).resolves.toEqual({ success: true });
    await expect(service.summary(writerId)).resolves.toMatchObject({ eventCount: 0 });
    await expect(service.summary(otherId)).resolves.toMatchObject({ eventCount: 1 });

    await dataSource.getRepository(User).delete(otherId);
    await expect(dataSource.getRepository(CalendarEvent).count()).resolves.toBe(0);
  });

  it('keeps an event either all day or timed', async () => {
    await expect(dataSource.query(
      `INSERT INTO calendar_events (user_id, uid, summary, all_day, starts_at, ends_at) VALUES ($1, 'x', '', true, now(), now())`,
      [writerId],
    )).rejects.toThrow(/chk_calendar_events_when/);
  });
});
