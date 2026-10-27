import { parseByteRange } from './byte-range.util';

describe('parseByteRange', () => {
  it.each([
    ['bytes=0-99', { start: 0, end: 99 }],
    ['bytes=100-', { start: 100, end: 999 }],
    ['bytes=900-5000', { start: 900, end: 999 }],
    ['bytes=-100', { start: 900, end: 999 }],
    ['bytes=-5000', { start: 0, end: 999 }],
    [' bytes=5-5 ', { start: 5, end: 5 }],
  ])('reads %p of a 1000-byte file', (header, range) => {
    expect(parseByteRange(header, 1000)).toEqual(range);
  });

  it.each([
    [undefined],
    [''],
    ['bytes=-'],
    ['bytes=0-1,5-9'],
    ['items=0-9'],
    ['bytes=9-0'],
    ['bytes=abc-'],
  ])('sends the whole file for %p', (header) => {
    expect(parseByteRange(header, 1000)).toBeNull();
  });

  it.each([
    ['bytes=1000-', 1000],
    ['bytes=1000-2000', 1000],
    ['bytes=-0', 1000],
    ['bytes=-10', 0],
    ['bytes=0-', 0],
  ])('answers %p of a %p-byte file as unsatisfiable', (header, size) => {
    expect(parseByteRange(header, size)).toBe('unsatisfiable');
  });
});
