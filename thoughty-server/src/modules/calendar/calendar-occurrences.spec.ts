import type { CalendarEvent } from '@/database/entities';
import { occurrenceOn } from './calendar-occurrences';
import type { EventRecurrence, RecurrenceRule } from './calendar-recurrence';

const yearly: RecurrenceRule = { freq: 'YEARLY', interval: 1, weekStart: 1 };
const weekly: RecurrenceRule = { freq: 'WEEKLY', interval: 1, weekStart: 1 };
const daily: RecurrenceRule = { freq: 'DAILY', interval: 1, weekStart: 1 };

const repeating = (recurrence: Partial<EventRecurrence>) =>
  ({ rule: null, until: null, rdates: [], exdates: [], timeZone: 'UTC', ...recurrence }) as EventRecurrence;

const allDay = (startDate: string, endDate: string, recurrence: Partial<EventRecurrence>) =>
  ({ id: 1, allDay: true, startsAt: null, endsAt: null, startDate, endDate, recurrence: repeating(recurrence) }) as CalendarEvent;

const timed = (startsAt: string, endsAt: string, recurrence: Partial<EventRecurrence>) =>
  ({ id: 2, allDay: false, startsAt: new Date(startsAt), endsAt: new Date(endsAt), startDate: null, endDate: null, recurrence: repeating(recurrence) }) as CalendarEvent;

describe('occurrenceOn', () => {
  it('finds nothing for a one-off event, or a timed one without a start', () => {
    expect(occurrenceOn({ ...allDay('2026-03-14', '2026-03-14', {}), recurrence: null } as CalendarEvent, '2026-03-14', 'UTC')).toBeNull();
    expect(occurrenceOn({ ...timed('2026-03-14T10:00:00Z', '2026-03-14T11:00:00Z', {}), startsAt: null } as CalendarEvent, '2026-03-14', 'UTC')).toBeNull();
  });

  it('repeats an all-day event by its rule up to its last day, with its extra days and without its removed ones', () => {
    const birthday = allDay('1990-03-14', '1990-03-14', { rule: yearly, until: '2030-03-14', rdates: ['2026-03-20', '1989-01-01'], exdates: ['2027-03-14'] });

    expect(occurrenceOn(birthday, '2026-03-14', 'Asia/Tokyo')).toEqual({ startDate: '2026-03-14', endDate: '2026-03-14' });
    expect(occurrenceOn(birthday, '2026-03-15', 'UTC')).toBeNull();
    expect(occurrenceOn(birthday, '2026-03-20', 'UTC')).toEqual({ startDate: '2026-03-20', endDate: '2026-03-20' });
    expect(occurrenceOn(birthday, '2027-03-14', 'UTC')).toBeNull();
    expect(occurrenceOn(birthday, '2030-03-14', 'UTC')).toEqual({ startDate: '2030-03-14', endDate: '2030-03-14' });
    expect(occurrenceOn(birthday, '2031-03-14', 'UTC')).toBeNull();
    // Extra days before the first are not occurrences
    expect(occurrenceOn(birthday, '1989-01-01', 'UTC')).toBeNull();
    expect(occurrenceOn(birthday, '1990-03-13', 'UTC')).toBeNull();
  });

  it('lists the first occurrence of a several-day event that covers the day', () => {
    const weekend = allDay('2026-11-06', '2026-11-08', { rule: weekly });
    expect(occurrenceOn(weekend, '2026-11-15', 'UTC')).toEqual({ startDate: '2026-11-13', endDate: '2026-11-15' });
    expect(occurrenceOn(weekend, '2026-11-16', 'UTC')).toBeNull();

    const retreat = allDay('2026-11-01', '2026-11-03', { rule: daily });
    expect(occurrenceOn(retreat, '2026-11-10', 'UTC')).toEqual({ startDate: '2026-11-08', endDate: '2026-11-10' });
  });

  it('repeats an event without a rule on its first and extra days only', () => {
    const event = allDay('2026-11-01', '2026-11-01', { rdates: ['2026-12-01'] });
    expect(occurrenceOn(event, '2026-11-01', 'UTC')).toEqual({ startDate: '2026-11-01', endDate: '2026-11-01' });
    expect(occurrenceOn(event, '2026-12-01', 'UTC')).toEqual({ startDate: '2026-12-01', endDate: '2026-12-01' });
    expect(occurrenceOn(event, '2026-11-08', 'UTC')).toBeNull();
  });

  it('repeats a timed event at its wall-clock time in its zone, across a daylight-saving change, on the writer’s day', () => {
    // 19:00 in Paris on Mondays: 17:00 UTC in summer time, 18:00 UTC from 25 October
    const yoga = timed('2026-10-19T17:00:00Z', '2026-10-19T18:00:00Z', {
      rule: weekly,
      until: '2026-11-23T18:00:00.000Z',
      rdates: ['2026-11-04T08:00:00.000Z'],
      exdates: ['2026-11-09T18:00:00.000Z', '2026-11-16'],
      timeZone: 'Europe/Paris',
    });

    expect(occurrenceOn(yoga, '2026-10-19', 'Europe/Paris')).toEqual({ startsAt: new Date('2026-10-19T17:00:00Z'), endsAt: new Date('2026-10-19T18:00:00Z') });
    expect(occurrenceOn(yoga, '2026-11-02', 'Europe/Paris')).toEqual({ startsAt: new Date('2026-11-02T18:00:00Z'), endsAt: new Date('2026-11-02T19:00:00Z') });
    // In Tokyo the Monday evening in Paris is Tuesday morning
    expect(occurrenceOn(yoga, '2026-11-03', 'Asia/Tokyo')).toEqual({ startsAt: new Date('2026-11-02T18:00:00Z'), endsAt: new Date('2026-11-02T19:00:00Z') });
    expect(occurrenceOn(yoga, '2026-11-02', 'Asia/Tokyo')).toBeNull();
    expect(occurrenceOn(yoga, '2026-11-04', 'Europe/Paris')).toEqual({ startsAt: new Date('2026-11-04T08:00:00Z'), endsAt: new Date('2026-11-04T09:00:00Z') });
    // Removed by its instant, then by its day; the last one is on the 23rd
    expect(occurrenceOn(yoga, '2026-11-09', 'Europe/Paris')).toBeNull();
    expect(occurrenceOn(yoga, '2026-11-16', 'Europe/Paris')).toBeNull();
    expect(occurrenceOn(yoga, '2026-11-23', 'Europe/Paris')).toEqual({ startsAt: new Date('2026-11-23T18:00:00Z'), endsAt: new Date('2026-11-23T19:00:00Z') });
    expect(occurrenceOn(yoga, '2026-11-30', 'Europe/Paris')).toBeNull();
    expect(occurrenceOn(yoga, '2026-10-12', 'Europe/Paris')).toBeNull();
  });

  it('lists the first occurrence that overlaps the day, one from the night before included, and an instant on its day', () => {
    const nightShift = timed('2026-11-01T23:00:00Z', '2026-11-02T01:00:00Z', { rule: daily });
    expect(occurrenceOn(nightShift, '2026-11-05', 'UTC')).toEqual({ startsAt: new Date('2026-11-04T23:00:00Z'), endsAt: new Date('2026-11-05T01:00:00Z') });

    const reminder = timed('2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z', { rule: daily, until: '2026-11-03T00:00:00.000Z' });
    expect(occurrenceOn(reminder, '2026-11-03', 'UTC')).toEqual({ startsAt: new Date('2026-11-03T00:00:00Z'), endsAt: new Date('2026-11-03T00:00:00Z') });
    expect(occurrenceOn(reminder, '2026-11-04', 'UTC')).toBeNull();
  });
});
