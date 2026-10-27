import { extractMentionHandles, findMentions, MENTION_HANDLE_MAX_LENGTH, normalizeMentionHandle } from './entry-mentions.util';

const written = (content: string) => findMentions(content).map((mention) => mention.written);

describe('entry mentions', () => {
  it('reads handles of any script, joined by hyphens or underscores, with their positions', () => {
    expect(findMentions('Lunch with @Marie and @Jean-Paul.')).toEqual([
      { handle: 'marie', written: 'Marie', start: 11, end: 17 },
      { handle: 'jean-paul', written: 'Jean-Paul', start: 22, end: 32 },
    ]);
    expect(written('@李雷 meets @محمد, @Ольга and @Zoë-2 or @marie_c')).toEqual(['李雷', 'محمد', 'Ольга', 'Zoë-2', 'marie_c']);
    expect(written('(@Anna) "@Ben" *@Cleo* _@Dan_ **@Eve** @Fay\n@Gus')).toEqual(['Anna', 'Ben', 'Cleo', 'Dan', 'Eve', 'Fay', 'Gus']);
  });

  it('ends a handle before punctuation, a possessive or a trailing joiner', () => {
    expect(written("@Marie's book, @Paul! @Lea? @Max- and @Ivy_ or @Kim--then")).toEqual(['Marie', 'Paul', 'Lea', 'Max', 'Ivy', 'Kim']);
  });

  it('leaves e-mail addresses, domains, profile URLs, escapes and numbers alone', () => {
    expect(written('marie@example.com, @example.com, site.com/@bob, \\@escaped, @2pm, @@double, a+@b, x-@y')).toEqual([]);
  });

  it('skips code, cross-references, links, autolinks and web addresses', () => {
    const content = [
      'Inline `@code` and ``@double `ticks` @inside``.',
      '```js',
      '@fenced',
      '```',
      '~~~',
      '@tilde',
      '~~~',
      '[[2024-01-01#2]] [@Linked](https://x.com/@a) ![@alt](img.png)',
      'https://medium.com/@bob www.x.com/@c <https://a.b/@d>',
      'Then @After',
    ].join('\n');

    expect(written(content)).toEqual(['After']);
    expect(written('```\n@unclosed fence')).toEqual([]);
    expect(written('a lone ` then @Open')).toEqual(['Open']);
  });

  it('refuses a handle longer than the limit rather than cutting it', () => {
    const longest = 'b'.repeat(MENTION_HANDLE_MAX_LENGTH);
    expect(written(`@${'a'.repeat(MENTION_HANDLE_MAX_LENGTH + 1)} @${longest}`)).toEqual([longest]);
  });

  it('compares handles without case, in their composed form', () => {
    expect(normalizeMentionHandle('@ÉLODIE')).toBe('élodie');
    expect(normalizeMentionHandle('Élodie')).toBe('élodie');
    expect(extractMentionHandles('@Marie met @marie, @MARIE and @Bob')).toEqual([
      { handle: 'marie', written: 'Marie' },
      { handle: 'bob', written: 'Bob' },
    ]);
    expect(extractMentionHandles('')).toEqual([]);
    expect(extractMentionHandles('no mention here')).toEqual([]);
  });
});
