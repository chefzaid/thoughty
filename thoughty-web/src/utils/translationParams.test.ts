import { describe, expect, it } from 'vitest';

import { pluralPhrase } from './pluralPhrase';
import { fillTranslationParams } from './translationParams';
import { getTranslation } from './translations';

const REPLACEMENT_PATTERNS = ['a$&b.pdf', 'a$1b.pdf', 'a$$b.pdf', "a$'b.pdf", 'a$`b.pdf', 'a$<name>b.pdf'];

describe('fillTranslationParams', () => {
  it.each(REPLACEMENT_PATTERNS)('inserts %s as written', (value) => {
    expect(fillTranslationParams('Before {name} after', { name: value })).toBe(`Before ${value} after`);
  });

  it('fills every placeholder for a parameter, including repeats', () => {
    expect(fillTranslationParams('{n} of {total}, {n}', { n: 2, total: 5 })).toBe('2 of 5, 2');
  });

  it('does not fill a placeholder that a value brings in', () => {
    expect(fillTranslationParams('{name}: {reason}', { name: '{reason}.pdf', reason: 'Too big' }))
      .toBe('{reason}.pdf: Too big');
  });

  it('leaves placeholders without a parameter and ignores inherited properties', () => {
    expect(fillTranslationParams('{name} {toString}', { other: 'x' })).toBe('{name} {toString}');
    expect(fillTranslationParams('No parameters {here}')).toBe('No parameters {here}');
  });
});

describe('getTranslation parameters', () => {
  it.each(REPLACEMENT_PATTERNS)('puts the file name %s into the message as written', (name) => {
    expect(getTranslation('en', 'attachmentRejected', { reason: 'x', name })).toBe(`${name}: x`);
  });

  it('puts a value with replacement patterns into a French message as written', () => {
    expect(getTranslation('fr', 'attachmentRejected', { reason: "$'", name: '$$' })).toBe('$$ : $\'');
  });

  it('fills a key that has no translation as the text itself', () => {
    expect(getTranslation('en', 'Hello {who}', { who: '$&' })).toBe('Hello $&');
  });
});

describe('pluralPhrase parameters', () => {
  it.each(REPLACEMENT_PATTERNS)('puts %s into the plural message as written', (date) => {
    const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

    expect(pluralPhrase(t, 'statsHeatmapDay', 2, 'en', { date })).toBe(`2 entries on ${date}`);
  });
});

describe('getTranslation without a key', () => {
  it('returns a key missing at run time as it was', () => {
    expect(getTranslation('en', undefined as unknown as string)).toBeUndefined();
  });
});
