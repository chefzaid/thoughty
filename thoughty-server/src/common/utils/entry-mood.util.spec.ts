import { MAX_FEELING_LENGTH, MAX_FEELINGS, normalizeFeeling, normalizeFeelings, normalizeMood } from './entry-mood.util';

describe('entry-mood.util', () => {
  it.each([
    [1, 1],
    [5, 5],
    ['3', 3],
    [' 4 ', 4],
    [0, null],
    [6, null],
    [2.5, null],
    ['good', null],
    ['', null],
    [null, null],
    [undefined, null],
  ])('reads %p as the mood %p', (input, expected) => {
    expect(normalizeMood(input)).toBe(expected);
  });

  it('keeps a feeling word on one line, lowercase, and without delimiters', () => {
    expect(normalizeFeeling('  Calm\n and   Rested ')).toBe('calm and rested');
    expect(normalizeFeeling('happy, {sad} | [tired]; "ok" `x`')).toBe('happy sad tired ok x');
    expect(normalizeFeeling('Épuisé')).toBe('épuisé');
    expect(normalizeFeeling('x'.repeat(60))).toHaveLength(MAX_FEELING_LENGTH);
    expect(normalizeFeeling(' ,; ')).toBeNull();
    expect(normalizeFeeling(4)).toBeNull();
  });

  it('cleans a list of feelings, dropping duplicates and empty words, up to ten', () => {
    expect(normalizeFeelings(['Calm', 'calm ', '', 'grateful', 7])).toEqual(['calm', 'grateful']);
    expect(normalizeFeelings('calm, grateful,,tired')).toEqual(['calm', 'grateful', 'tired']);
    expect(normalizeFeelings(Array.from({ length: 15 }, (_, index) => `word ${index}`))).toHaveLength(MAX_FEELINGS);
    expect(normalizeFeelings(null)).toEqual([]);
    expect(normalizeFeelings({ calm: true })).toEqual([]);
  });
});
