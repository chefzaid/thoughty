import { escapeLikePattern, parseEntrySearch } from './entry-search-query';

describe('parseEntrySearch', () => {
  it('reads the last bare word as a prefix of the search before it', () => {
    expect(parseEntrySearch('  morning journ ')).toEqual({
      text: 'morning journ',
      prefix: { word: 'journ', rest: 'morning', joinWithOr: false },
      terms: [
        { text: 'morning', prefix: false },
        { text: 'journ', prefix: true },
      ],
    });
  });

  it('joins the prefix with OR when the word before it is OR, in any case', () => {
    expect(parseEntrySearch('sea Or lak').prefix).toEqual({ word: 'lak', rest: 'sea', joinWithOr: true });
  });

  it('keeps phrases and drops excluded words and operators from the highlighted terms', () => {
    const parsed = parseEntrySearch('"morning run" -rain -"bad weather" or swim');

    expect(parsed.terms).toEqual([
      { text: 'morning run', prefix: false },
      { text: 'swim', prefix: true },
    ]);
    expect(parsed.prefix).toEqual({ word: 'swim', rest: '"morning run" -rain -"bad weather"', joinWithOr: true });
  });

  it('does not read a prefix from a phrase, an exclusion, an operator, a single letter, or punctuation', () => {
    expect(parseEntrySearch('"morning run"').prefix).toBeUndefined();
    expect(parseEntrySearch('"morning ru').prefix).toBeUndefined();
    expect(parseEntrySearch('walk -rain').prefix).toBeUndefined();
    expect(parseEntrySearch('walk or').prefix).toBeUndefined();
    expect(parseEntrySearch('walk a').prefix).toBeUndefined();
    expect(parseEntrySearch("aujourd'hui").prefix).toBeUndefined();
    expect(parseEntrySearch('c++').prefix).toBeUndefined();
  });

  it('accepts accented letters and digits in a prefix', () => {
    expect(parseEntrySearch('été').prefix?.word).toBe('été');
    expect(parseEntrySearch('2019').prefix?.word).toBe('2019');
  });

  it('keeps at most the last ten terms to highlight', () => {
    const words = Array.from({ length: 12 }, (_, index) => `word${index}`);
    const parsed = parseEntrySearch(words.join(' '));

    expect(parsed.terms).toHaveLength(10);
    expect(parsed.terms[0].text).toBe('word2');
    expect(parsed.terms.at(-1)).toEqual({ text: 'word11', prefix: true });
  });

  it('returns nothing to search for blank input', () => {
    expect(parseEntrySearch('   ')).toEqual({ text: '', prefix: undefined, terms: [] });
  });
});

describe('escapeLikePattern', () => {
  it('escapes LIKE wildcards and backslashes', () => {
    expect(escapeLikePattern(String.raw`50%_off\now`)).toBe(String.raw`50\%\_off\\now`);
  });
});
