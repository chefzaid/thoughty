import {
  compareOpenTaskPositions,
  formatOpenTaskCursor,
  OPEN_TASK_CURSOR_PATTERN,
  parseOpenTaskCursor,
  type OpenTaskPosition,
} from './entry-open-tasks.cursor';

const at = (overrides: Partial<OpenTaskPosition> = {}): OpenTaskPosition =>
  ({ date: '2026-10-21', timeOfDay: null, index: 1, id: 42, line: 3, ...overrides });

describe('open task cursor', () => {
  it('writes the sort values and reads them back, with or without a time of day', () => {
    expect(formatOpenTaskCursor(at())).toBe('2026-10-21__1_42_3');
    expect(formatOpenTaskCursor(at({ timeOfDay: '09:30' }))).toBe('2026-10-21_09:30_1_42_3');
    expect(parseOpenTaskCursor('2026-10-21__1_42_3')).toEqual(at());
    expect(parseOpenTaskCursor('2026-10-21_09:30_2_7_0')).toEqual(at({ timeOfDay: '09:30', index: 2, id: 7, line: 0 }));
  });

  it.each(['', '42', '2026-10-21_1_42_3', '2026-10-21__1_42_-3', '2026-10-21_9:30_1_42_3', "2026-10-21__1_42_3' OR 1=1"])(
    'refuses %p',
    (cursor) => {
      expect(OPEN_TASK_CURSOR_PATTERN.test(cursor)).toBe(false);
      expect(() => parseOpenTaskCursor(cursor)).toThrow('Invalid open task cursor');
    },
  );

  it("orders positions as the list does: newest day first, untimed entries first, then time, order, id and line", () => {
    const ordered = [
      at({ date: '2026-10-22', id: 99 }),
      at({ index: 2, id: 1 }),
      at({ index: 3, id: 1 }),
      at({ timeOfDay: '08:00', index: 1, id: 5 }),
      at({ timeOfDay: '09:30', index: 1, id: 2, line: 0 }),
      at({ timeOfDay: '09:30', index: 1, id: 2, line: 4 }),
      at({ timeOfDay: '09:30', index: 1, id: 3, line: 0 }),
      at({ date: '2025-01-01' }),
    ];
    const shuffled = [ordered[5], ordered[0], ordered[7], ordered[2], ordered[4], ordered[1], ordered[6], ordered[3]];

    expect([...shuffled].sort(compareOpenTaskPositions)).toEqual(ordered);
    expect(compareOpenTaskPositions(at(), at())).toBe(0);
  });
});
