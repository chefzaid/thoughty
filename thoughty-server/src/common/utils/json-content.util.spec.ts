import { extractJsonCandidate, trimCharacters } from './json-content.util';

describe('AI response text boundaries', () => {
  it('extracts JSON objects and arrays wrapped in prose or code fences', () => {
    expect(JSON.parse(extractJsonCandidate('Result: ```json\n{"nested":{"value":1}}\n```', '{')!))
      .toEqual({ nested: { value: 1 } });
    expect(JSON.parse(extractJsonCandidate('Suggestions: ["one","two"] done', '[')!))
      .toEqual(['one', 'two']);
  });

  it('preserves whole JSON-looking replies so trailing garbage is rejected by the parser', () => {
    expect(() => JSON.parse(extractJsonCandidate('{"value":1} invalid', '{')!)).toThrow();
  });

  it('rejects missing or reversed delimiters, including long malformed replies', () => {
    expect(extractJsonCandidate('Prose ' + '{'.repeat(100_000), '{')).toBeUndefined();
    expect(extractJsonCandidate('Prose ' + '['.repeat(100_000), '[')).toBeUndefined();
    expect(extractJsonCandidate('} trailing {', '{')).toBeUndefined();
    expect(extractJsonCandidate('No JSON here', '{')).toBeUndefined();
  });

  it('trims only boundary punctuation and preserves internal Unicode punctuation', () => {
    expect(trimCharacters("--l’été--", "'’- ")).toBe('l’été');
    expect(trimCharacters('-'.repeat(100_000), '-')).toBe('');
    expect(trimCharacters('', '-')).toBe('');
  });
});
