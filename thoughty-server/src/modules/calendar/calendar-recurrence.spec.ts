import { parseRrule, repeatDays, type RecurrenceRule } from './calendar-recurrence';

const rule = (value: string): RecurrenceRule => {
  const parsed = parseRrule(value);
  if (!parsed) throw new Error(`Unreadable rule ${value}`);
  return parsed.rule;
};

describe('parseRrule', () => {
  it('reads the rule parts it follows, with Monday as the first day of the week', () => {
    expect(parseRrule('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;UNTIL=20261231T235959Z')).toEqual({
      rule: { freq: 'WEEKLY', interval: 2, weekStart: 1, byDay: [{ weekday: 2 }, { weekday: 4 }] },
      until: '20261231T235959Z',
    });
    expect(parseRrule('freq=monthly;count=10;byday=-1fr,2MO;bymonth=1,12;bysetpos=1;bymonthday=-1,15;wkst=su')).toEqual({
      rule: {
        freq: 'MONTHLY',
        interval: 1,
        count: 10,
        weekStart: 0,
        byDay: [{ weekday: 5, ordinal: -1 }, { weekday: 1, ordinal: 2 }],
        byMonth: [1, 12],
        bySetPos: [1],
        byMonthDay: [-1, 15],
      },
      until: null,
    });
  });

  it.each([
    ['no frequency', 'INTERVAL=2'],
    ['a frequency within a day', 'FREQ=HOURLY'],
    ['hours of the day', 'FREQ=DAILY;BYHOUR=9,17'],
    ['week numbers', 'FREQ=YEARLY;BYWEEKNO=20'],
    ['a ranked weekday in a weekly rule', 'FREQ=WEEKLY;BYDAY=1MO'],
    ['a zero interval', 'FREQ=DAILY;INTERVAL=0'],
    ['a zero count', 'FREQ=DAILY;COUNT=0'],
    ['an unknown weekday', 'FREQ=WEEKLY;BYDAY=XX'],
    ['a month past December', 'FREQ=YEARLY;BYMONTH=13'],
    ['a zero month day', 'FREQ=MONTHLY;BYMONTHDAY=0'],
    ['a list with a gap', 'FREQ=MONTHLY;BYMONTHDAY=1,,2'],
    ['an unknown week start', 'FREQ=WEEKLY;WKST=XX'],
    ['a part said twice', 'FREQ=DAILY;FREQ=WEEKLY'],
    ['a part without a value', 'FREQ=DAILY;COUNT'],
  ])('refuses %s', (_case, value) => {
    expect(parseRrule(value)).toBeNull();
  });
});

describe('repeatDays', () => {
  it('repeats every few days', () => {
    expect(repeatDays(rule('FREQ=DAILY;INTERVAL=2'), '2026-11-01', '2026-11-20', '2026-11-25')).toEqual(['2026-11-21', '2026-11-23', '2026-11-25']);
  });

  it('repeats weekly on the first day’s weekday, or on the days given, every other week', () => {
    expect(repeatDays(rule('FREQ=WEEKLY'), '2026-11-02', '2026-11-01', '2026-11-30')).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
    expect(repeatDays(rule('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH'), '2026-11-03', '2026-11-01', '2026-11-30')).toEqual(['2026-11-03', '2026-11-05', '2026-11-17', '2026-11-19']);
    // A Sunday-first week puts this Sunday in the week of the first Tuesday, and the next one two weeks on
    expect(repeatDays(rule('FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,TU;WKST=SU'), '2026-11-03', '2026-11-01', '2026-11-22')).toEqual(['2026-11-03', '2026-11-15', '2026-11-17']);
  });

  it('repeats monthly on a day of the month, the last one, the last Friday, or the last weekday', () => {
    expect(repeatDays(rule('FREQ=MONTHLY'), '2026-01-31', '2026-01-01', '2026-05-31')).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
    expect(repeatDays(rule('FREQ=MONTHLY;BYMONTHDAY=-1'), '2026-01-31', '2026-02-01', '2026-04-30')).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
    expect(repeatDays(rule('FREQ=MONTHLY;BYDAY=-1FR'), '2026-10-30', '2026-11-01', '2026-12-31')).toEqual(['2026-11-27', '2026-12-25']);
    expect(repeatDays(rule('FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1'), '2026-10-30', '2026-11-01', '2026-12-31')).toEqual(['2026-11-30', '2026-12-31']);
    expect(repeatDays(rule('FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1,15'), '2026-01-01', '2026-03-01', '2026-07-31')).toEqual(['2026-04-01', '2026-04-15', '2026-07-01', '2026-07-15']);
  });

  it('repeats yearly on the first day’s date, a 29 February only in leap years, or a ranked weekday', () => {
    expect(repeatDays(rule('FREQ=YEARLY'), '1990-03-14', '2026-01-01', '2027-12-31')).toEqual(['2026-03-14', '2027-03-14']);
    expect(repeatDays(rule('FREQ=YEARLY'), '2024-02-29', '2025-01-01', '2028-12-31')).toEqual(['2028-02-29']);
    // The fourth Thursday of November, and the first Monday of the year
    expect(repeatDays(rule('FREQ=YEARLY;BYMONTH=11;BYDAY=4TH'), '2020-11-26', '2026-01-01', '2026-12-31')).toEqual(['2026-11-26']);
    expect(repeatDays(rule('FREQ=YEARLY;BYDAY=1MO'), '2026-01-05', '2026-01-01', '2027-12-31')).toEqual(['2026-01-05', '2027-01-04']);
    // The first day of the month given, in every year
    expect(repeatDays(rule('FREQ=YEARLY;BYMONTH=6'), '2026-01-10', '2026-01-01', '2026-12-31')).toEqual(['2026-01-10', '2026-06-10']);
  });

  it('counts the first day, even off the rule, toward the count', () => {
    // The first day is a Monday, the rule's days are Tuesdays
    expect(repeatDays(rule('FREQ=WEEKLY;BYDAY=TU;COUNT=3'), '2026-11-02', '2026-11-01', '2026-12-31')).toEqual(['2026-11-02', '2026-11-03', '2026-11-10']);
    expect(repeatDays(rule('FREQ=DAILY;COUNT=1'), '2026-11-02', '2026-11-01', '2026-12-31')).toEqual(['2026-11-02']);
    expect(repeatDays(rule('FREQ=DAILY;COUNT=5'), '2026-11-02', '2026-11-05', '2026-12-31')).toEqual(['2026-11-05', '2026-11-06']);
  });

  it('finds nothing before the first day, and stops for a counted rule that never matches', () => {
    expect(repeatDays(rule('FREQ=WEEKLY'), '2026-11-02', '2026-10-01', '2026-10-31')).toEqual([]);
    expect(repeatDays(rule('FREQ=MONTHLY;BYMONTH=2;BYMONTHDAY=30;COUNT=2'), '2026-01-30', '2026-02-01', '2030-12-31')).toEqual([]);
  });
});
