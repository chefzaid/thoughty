import { describe, expect, it } from 'vitest';
import {
  cardFilename,
  ELLIPSIS,
  ellipsize,
  fitText,
  formatCardDate,
  selectedExcerpt,
  splitGraphemes,
  toCardText,
  wrapText,
} from './shareCardLayout';

/** Every character is 10 units wide, so a 100-unit line holds 10 characters. */
const measure = (text: string) => splitGraphemes(text).length * 10;

describe('splitGraphemes', () => {
  it('keeps emoji sequences and accented letters whole', () => {
    expect(splitGraphemes('a👩‍👩‍👧é🍁')).toEqual(['a', '👩‍👩‍👧', 'é', '🍁']);
  });
});

describe('toCardText', () => {
  it('keeps plain text, collapsing spaces and blank lines between paragraphs', () => {
    expect(toCardText('  First   line\r\n\r\n\r\nSecond\tline  ')).toBe('First line\nSecond line');
  });

  it('drops Markdown syntax, task boxes and entry links', () => {
    const markdown = [
      '# A heading',
      '> A **bold** and _soft_ quote',
      '- [x] Done task',
      '1. First ~~item~~',
      '---',
      'See [the docs](https://example.com) and ![a photo](x.png), `code` and [[2026-10-12#1]].',
      '```js',
      'const x = 1;',
      '```',
    ].join('\n');

    expect(toCardText(markdown, 'markdown')).toBe([
      'A heading',
      'A bold and soft quote',
      'Done task',
      'First item',
      'See the docs and a photo, code and 2026-10-12#1.',
      'const x = 1;',
    ].join('\n'));
  });

  it('leaves Markdown-looking characters alone in plain entries', () => {
    expect(toCardText('# not a heading **really**')).toBe('# not a heading **really**');
  });
});

describe('selectedExcerpt', () => {
  const cardText = 'The maple turned red.\nI sat with my tea.';

  it('uses a selection that comes from the entry, across its lines', () => {
    expect(selectedExcerpt('  red.\n I sat ', cardText)).toBe('red. I sat');
  });

  it('ignores an empty selection or one from elsewhere on the page', () => {
    expect(selectedExcerpt(undefined, cardText)).toBeUndefined();
    expect(selectedExcerpt('   ', cardText)).toBeUndefined();
    expect(selectedExcerpt('Saved searches', cardText)).toBeUndefined();
  });
});

describe('ellipsize', () => {
  it('drops whole words until the ellipsis fits, without dangling punctuation', () => {
    expect(ellipsize('Hello, world', 70, measure)).toBe(`Hello${ELLIPSIS}`);
    expect(ellipsize('Hi', 100, measure)).toBe(`Hi${ELLIPSIS}`);
  });

  it('cuts a single long word character by character', () => {
    expect(ellipsize('Wonderful', 50, measure)).toBe(`Wond${ELLIPSIS}`);
  });

  it('falls back to the ellipsis alone on a very narrow line', () => {
    expect(ellipsize('Hello', 5, measure)).toBe(ELLIPSIS);
  });
});

describe('wrapText', () => {
  it('wraps words onto lines that fit and keeps line breaks', () => {
    expect(wrapText('one two three four\nfive', 100, 10, measure)).toEqual({
      lines: ['one two', 'three four', 'five'],
      truncated: false,
    });
  });

  it('breaks a word longer than the line without splitting an emoji', () => {
    expect(wrapText('ab 0123456789🍁xyz end', 100, 10, measure).lines).toEqual(['ab', '0123456789', '🍁xyz end']);
  });

  it('stops at the line limit and ends the last line with an ellipsis', () => {
    const wrapped = wrapText('one two three four five six', 100, 2, measure);

    expect(wrapped).toEqual({ lines: ['one two', `three${ELLIPSIS}`], truncated: true });
  });

  it('cuts a long word that runs past the limit', () => {
    expect(wrapText('abcdefghijklmnopqrstuvwxyz', 100, 1, measure)).toEqual({
      lines: [`abcdefghi${ELLIPSIS}`],
      truncated: true,
    });
  });

  it('always allows one line and returns none for empty text', () => {
    expect(wrapText('one two', 100, 0, measure).lines).toEqual(['one two']);
    expect(wrapText('  \n ', 100, 3, measure)).toEqual({ lines: [], truncated: false });
  });
});

describe('fitText', () => {
  const measureAt = (fontSize: number) => (text: string) => splitGraphemes(text).length * fontSize;
  const options = { maxWidth: 200, maxHeight: 60, maxFontSize: 20, minFontSize: 10, lineHeightRatio: 1.5, measureAt };

  it('picks the largest size at which the whole text fits', () => {
    const fitted = fitText('short', options);

    expect(fitted).toMatchObject({ fontSize: 20, lineHeight: 30, lines: ['short'], truncated: false });
  });

  it('shrinks the text before cutting it', () => {
    const fitted = fitText('a few more words here today', options);

    expect(fitted).toMatchObject({ fontSize: 12, truncated: false, lines: ['a few more words', 'here today'] });
  });

  it('cuts the text with an ellipsis at the smallest size when nothing fits', () => {
    const fitted = fitText('word '.repeat(60), options);

    expect(fitted).toMatchObject({ fontSize: 10, lineHeight: 15, truncated: true });
    expect(fitted.lines).toHaveLength(4);
    expect(fitted.lines.at(-1)).toMatch(/…$/);
  });

  it('returns no lines when the size range is empty', () => {
    expect(fitText('text', { ...options, maxFontSize: 8 })).toEqual({ lines: [], truncated: false, fontSize: 10, lineHeight: 15 });
  });
});

describe('formatCardDate', () => {
  it('writes the day out in the reader language, whatever the time zone', () => {
    expect(formatCardDate('2026-10-12', 'en')).toBe('October 12, 2026');
    expect(formatCardDate('2026-10-12T23:30:00.000Z', 'fr')).toBe('12 octobre 2026');
  });

  it('shows an unreadable date as it is', () => {
    expect(formatCardDate('someday', 'en')).toBe('someday');
  });
});

describe('cardFilename', () => {
  it('names the file after the entry day', () => {
    expect(cardFilename('2026-10-12T08:00:00Z')).toBe('thoughty-2026-10-12.png');
    expect(cardFilename('unknown')).toBe('thoughty-card.png');
  });
});
