import { describe, expect, it } from 'vitest';
import { buildBookConverterRoute, readBookConverterEntryIds } from './appRouting';

describe('book converter route', () => {
  it('opens the book section of the current diary with the picked entries', () => {
    expect(buildBookConverterRoute(3, [5, 2])).toEqual({
      pathname: '/import-export',
      search: '?diary=3&section=book&format=txt',
      state: { bookEntryIds: [5, 2] },
    });
    expect(buildBookConverterRoute(null, [1]).search).toBe('?diary=all&section=book&format=txt');
  });

  it('reads only the positive whole IDs a navigation carries', () => {
    expect(readBookConverterEntryIds({ bookEntryIds: [4, 0, -1, 2.5, '7', 9] })).toEqual([4, 9]);
    expect(readBookConverterEntryIds({ bookEntryIds: 'nope' })).toEqual([]);
    expect(readBookConverterEntryIds(null)).toEqual([]);
    expect(readBookConverterEntryIds(undefined)).toEqual([]);
  });
});
