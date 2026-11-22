import { describe, expect, it } from 'vitest';

import {
  daysInMonth,
  formatPersonDate,
  newPersonDateDraft,
  personDateDrafts,
  readPersonDateDrafts,
  samePersonDates,
} from './personDates';

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

  it('makes a draft of each date, each with its own key, and a new one the birthday while there is none', () => {
    const drafts = personDateDrafts([
      { kind: 'anniversary', label: 'Wedding', month: 6, day: 2, year: 2012 },
      { kind: 'anniversary', label: null, month: 3, day: 14, year: null },
    ]);
    expect(drafts.map(({ key: _key, ...draft }) => draft)).toEqual([
      { kind: 'anniversary', label: 'Wedding', month: '6', day: '2', year: '2012' },
      { kind: 'anniversary', label: '', month: '3', day: '14', year: '' },
    ]);
    expect(new Set(drafts.map((draft) => draft.key)).size).toBe(2);
    const birthday = newPersonDateDraft(drafts);
    expect(birthday).toMatchObject({ kind: 'birthday', label: '', month: '', day: '', year: '' });
    expect(newPersonDateDraft([...drafts, birthday]).kind).toBe('anniversary');
    expect(newPersonDateDraft([]).key).not.toBe(birthday.key);
  });

  it('reads the drafts as typed into the dates to send, or the first one that cannot be and why', () => {
    const today = '2026-11-22';
    const draft = personDateDrafts([{ kind: 'birthday', label: null, month: 3, day: 14, year: null }])[0]!;
    const other = { ...draft, key: draft.key + 1000, kind: 'anniversary' as const, label: ' Wedding  ' };

    expect(readPersonDateDrafts([], today)).toEqual({ dates: [] });
    expect(readPersonDateDrafts([draft, { ...other, year: ' 1992 ' }], today)).toEqual({
      dates: [
        { kind: 'birthday', label: null, month: 3, day: 14, year: null },
        { kind: 'anniversary', label: 'Wedding', month: 3, day: 14, year: 1992 },
      ],
    });
    expect(readPersonDateDrafts([draft, { ...other, label: '   ' }], today)).toEqual({ dates: [expect.anything(), expect.objectContaining({ label: null })] });
    expect(readPersonDateDrafts([draft, { ...other, day: '' }], today)).toEqual({ error: 'personDateIncomplete', index: 1 });
    expect(readPersonDateDrafts([{ ...draft, month: '' }, { ...other, day: '' }], today)).toEqual({ error: 'personDateIncomplete', index: 0 });
    for (const year of ['92', '19921', 'ninety', '0999']) {
      expect(readPersonDateDrafts([draft, { ...other, year }], today)).toEqual({ error: 'apiError_PERSON_DATE_YEAR_INVALID', index: 1 });
    }
    // 29 February only in a leap year; a dated day not after today
    expect(readPersonDateDrafts([{ ...draft, month: '2', day: '29', year: '2001' }], today)).toEqual({ error: 'apiError_PERSON_DATE_INVALID', index: 0 });
    expect(readPersonDateDrafts([{ ...draft, month: '2', day: '29', year: '2000' }], today)).toEqual({ dates: [expect.objectContaining({ year: 2000 })] });
    expect(readPersonDateDrafts([{ ...draft, month: '11', day: '23', year: '2026' }], today)).toEqual({ error: 'apiError_PERSON_DATE_IN_FUTURE', index: 0 });
    expect(readPersonDateDrafts([{ ...draft, month: '11', day: '22', year: '2026' }], today)).toEqual({ dates: [expect.objectContaining({ year: 2026 })] });
  });

  it('tells whether the dates to send are the person’s, in order', () => {
    const birthday = { kind: 'birthday' as const, label: null, month: 3, day: 14, year: null };
    const wedding = { kind: 'anniversary' as const, label: 'Wedding', month: 6, day: 2, year: 2012 };
    expect(samePersonDates([birthday, wedding], [birthday, wedding])).toBe(true);
    expect(samePersonDates([{ kind: 'birthday', month: 3, day: 14 }], [birthday])).toBe(true);
    expect(samePersonDates([], [])).toBe(true);
    expect(samePersonDates([wedding, birthday], [birthday, wedding])).toBe(false);
    expect(samePersonDates([birthday], [birthday, wedding])).toBe(false);
    for (const change of [{ kind: 'anniversary' as const }, { label: 'First met' }, { month: 4 }, { day: 15 }, { year: 1992 }]) {
      expect(samePersonDates([{ ...birthday, ...change }], [birthday])).toBe(false);
    }
  });
});
