import { describe, expect, it } from 'vitest';
import {
  countEntryWords,
  estimateReadingTimeMinutes,
  getEntryMetrics,
} from './entryMetrics';

describe('entryMetrics', () => {
  it('counts plain words and ignores empty content', () => {
    expect(countEntryWords('A quiet morning thought')).toBe(4);
    expect(countEntryWords('   \n\t  ')).toBe(0);
  });

  it('counts readable markdown text without link syntax noise', () => {
    expect(countEntryWords('# Title\nA [useful note](https://example.test) with `code words`.')).toBe(7);
  });

  it('estimates reading time at 200 words per minute', () => {
    expect(estimateReadingTimeMinutes(0)).toBe(0);
    expect(estimateReadingTimeMinutes(1)).toBe(1);
    expect(estimateReadingTimeMinutes(201)).toBe(2);
  });

  it('returns word count and reading time together', () => {
    expect(getEntryMetrics('One two three')).toEqual({
      wordCount: 3,
      readingTimeMinutes: 1,
    });
  });
});
