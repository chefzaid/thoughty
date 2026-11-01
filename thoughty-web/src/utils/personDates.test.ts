import { describe, expect, it } from 'vitest';

import { daysInMonth, formatPersonDate, personDateDraft, readPersonDateDraft, samePersonDate } from './personDates';

describe('person dates', () => {
  it('gives February 29 days unless a known year had none, as the API checks', () => {
    expect([daysInMonth(2, null), daysInMonth(2, 2024), daysInMonth(2, 2000), daysInMonth(2, 1900), daysInMonth(2, 2023)]).toEqual([29, 29, 29, 28, 28]);
    expect([1, 4, 6, 9, 11, 12].map((month) => daysInMonth(month, null))).toEqual([31, 30, 30, 30, 30, 31]);
  });

  it('writes the date in the reader’s language, with the year only when it is known', () => {
    expect(formatPersonDate({ month: 3, day: 14, year: 1992 }, 'en')).toBe('March 14, 1992');
    expect(formatPersonDate({ month: 2, day: 29, year: null }, 'en')).toBe('February 29');
    expect(formatPersonDate({ month: 2, day: 29, year: null }, 'fr')).toBe('29 février');
  });

  it('reads the fields as typed into the date to send, or what is missing', () => {
    expect(personDateDraft(null)).toEqual({ kind: '', month: '', day: '', year: '' });
    const draft = personDateDraft({ kind: 'birthday', month: 3, day: 14, year: null });
    expect(draft).toEqual({ kind: 'birthday', month: '3', day: '14', year: '' });
    expect(readPersonDateDraft(draft)).toEqual({ date: { kind: 'birthday', month: 3, day: 14, year: null } });
    expect(readPersonDateDraft({ ...draft, year: ' 1992 ' })).toEqual({ date: { kind: 'birthday', month: 3, day: 14, year: 1992 } });
    expect(readPersonDateDraft({ ...draft, kind: '' })).toEqual({ date: null });
    expect(readPersonDateDraft({ ...draft, day: '' })).toEqual({ error: 'personDateIncomplete' });
    expect(readPersonDateDraft({ ...draft, month: '' })).toEqual({ error: 'personDateIncomplete' });
    for (const year of ['92', '19920', 'abcd', '-992']) {
      expect(readPersonDateDraft({ ...draft, year })).toEqual({ error: 'apiError_PERSON_DATE_YEAR_INVALID' });
    }
  });

  it('compares two dates, a missing year being null', () => {
    const date = { kind: 'birthday' as const, month: 3, day: 14, year: null };
    expect(samePersonDate(date, { ...date })).toBe(true);
    expect(samePersonDate(date, { kind: 'birthday', month: 3, day: 14 })).toBe(true);
    expect(samePersonDate(date, { ...date, year: 1992 })).toBe(false);
    expect(samePersonDate(date, { ...date, kind: 'anniversary' })).toBe(false);
    expect(samePersonDate(date, null)).toBe(false);
    expect(samePersonDate(null, null)).toBe(true);
  });
});
