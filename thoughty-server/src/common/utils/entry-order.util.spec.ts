import {
  addSameDayOrder,
  compareSameDayEntries,
  normalizeEntryTitle,
  normalizeTimeOfDay,
} from './entry-order.util';

describe('entry-order.util', () => {
  it('puts entries without a time first in their manual order, then the others by time', () => {
    const day = [
      { id: 'evening', index: 1, timeOfDay: '21:00' },
      { id: 'second', index: 3, timeOfDay: null },
      { id: 'morning', index: 4, timeOfDay: '07:30' },
      { id: 'first', index: 2 },
      { id: 'also-morning', index: 5, timeOfDay: '07:30' },
    ];

    expect([...day].sort(compareSameDayEntries).map((entry) => entry.id)).toEqual([
      'first',
      'second',
      'morning',
      'also-morning',
      'evening',
    ]);
  });

  it('orders a query by time, entries without one first, then by index', () => {
    const qb = { addOrderBy: jest.fn().mockReturnThis() };

    expect(addSameDayOrder(qb as never, 'e')).toBe(qb);
    expect(qb.addOrderBy.mock.calls).toEqual([
      ['e.timeOfDay', 'ASC', 'NULLS FIRST'],
      ['e.index', 'ASC'],
    ]);
  });

  it.each([
    ['08:30', '08:30'],
    ['8:05', '08:05'],
    ['23:59:59', '23:59'],
    [' 07:00 ', '07:00'],
    ['24:00', null],
    ['7h30', null],
    ['', null],
    [null, null],
    [undefined, null],
  ])('reads %p as the time of day %p', (input, expected) => {
    expect(normalizeTimeOfDay(input)).toBe(expected);
  });

  it('keeps titles on one line, trimmed, and drops empty ones', () => {
    expect(normalizeEntryTitle('  A walk\n by the  river ')).toBe('A walk by the river');
    expect(normalizeEntryTitle('   ')).toBeNull();
    expect(normalizeEntryTitle(null)).toBeNull();
    expect(normalizeEntryTitle('x'.repeat(250))).toHaveLength(200);
  });
});
