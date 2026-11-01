import { describe, expect, it } from 'vitest';
import { buildBookConverterRoute, readBookConverterStart } from './appRouting';

const PERSON_START = { kind: 'person', name: 'Marie', savedSearchId: 7, savedSearchName: 'Marie' } as const;

describe('book converter route', () => {
  it('opens the book section of the current diary with the picked entries', () => {
    expect(buildBookConverterRoute(3, { kind: 'entries', entryIds: [5, 2] })).toEqual({
      pathname: '/import-export',
      search: '?diary=3&section=book&format=txt',
      state: { bookStart: { kind: 'entries', entryIds: [5, 2] } },
    });
    expect(buildBookConverterRoute(null, { kind: 'entries', entryIds: [1] }).search).toBe('?diary=all&section=book&format=txt');
  });

  it("opens the book section of every diary on a person's saved search", () => {
    expect(buildBookConverterRoute(null, PERSON_START)).toEqual({
      pathname: '/import-export',
      search: '?diary=all&section=book&format=txt',
      state: { bookStart: PERSON_START },
    });
  });

  it('reads only the positive whole IDs a navigation carries', () => {
    expect(readBookConverterStart({ bookStart: { kind: 'entries', entryIds: [4, 0, -1, 2.5, '7', 9] } }))
      .toEqual({ kind: 'entries', entryIds: [4, 9] });
    expect(readBookConverterStart({ bookStart: { kind: 'entries', entryIds: [0] } })).toBeNull();
    expect(readBookConverterStart({ bookStart: { kind: 'entries', entryIds: 'nope' } })).toBeNull();
    expect(readBookConverterStart(null)).toBeNull();
    expect(readBookConverterStart(undefined)).toBeNull();
  });

  it('reads a person start only when it names the person and their saved search', () => {
    expect(readBookConverterStart({ bookStart: { ...PERSON_START, extra: true } })).toEqual(PERSON_START);
    expect(readBookConverterStart({ bookStart: { ...PERSON_START, savedSearchId: 0 } })).toBeNull();
    expect(readBookConverterStart({ bookStart: { ...PERSON_START, name: '  ' } })).toBeNull();
    expect(readBookConverterStart({ bookStart: { ...PERSON_START, savedSearchName: 4 } })).toBeNull();
    expect(readBookConverterStart({ bookStart: { kind: 'other' } })).toBeNull();
  });
});
