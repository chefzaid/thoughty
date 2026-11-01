import { entryWords, topWords } from './stats-words';
import { STOP_WORDS } from './stats-stop-words';

describe('entryWords', () => {
  it('leaves out common English words, contractions and possessives included', () => {
    expect(entryWords('I really think the garden is lovely today, and I don’t want to leave it.')).toEqual([
      'think', 'garden', 'lovely', 'leave',
    ]);
    expect(entryWords("My sister's garden. The writers’ room. It's late, we'll see.")).toEqual([
      'sister', 'garden', 'writers', 'room', 'late', 'see',
    ]);
  });

  it('strips French elisions with straight and typographic apostrophes, keeping the accents', () => {
    expect(entryWords('L’été est là : j’aime l\'odeur du café, qu’importe s’il pleut.')).toEqual([
      'aime', 'odeur', 'café', 'importe', 'pleut',
    ]);
    expect(entryWords('D’abord, jusqu’à l’aube, lorsqu’Hélène m’écrit, puisqu’elle n’oublie rien.')).toEqual([
      'aube', 'hélène', 'écrit', 'oublie', 'rien',
    ]);
    // A whole common word with an apostrophe stays out, and a word is never cut inside
    expect(entryWords('Aujourd’hui quelqu’un est passé ; aujourd’hui encore.')).toEqual(['passé']);
  });

  it('lowers the case with the accents, and counts composed and decomposed accents alike', () => {
    expect(entryWords('ÉTÉ Été été été Œuvre ÇA')).toEqual(['œuvre']);
    expect(entryWords('Rêve RÊVE rêve')).toEqual(['rêve', 'rêve', 'rêve']);
    // The server's own locale does not change how a capital I is lowered
    expect(entryWords('IDEAS Idea')).toEqual(['ideas', 'idea']);
  });

  it('leaves out Markdown syntax, code, links between entries, addresses and @mentions', () => {
    const content = [
      '# Morning **walk** with @Marie and @Jean-Paul',
      '- [x] _Bread_ ~~shop~~ > quote',
      'See [the river](https://example.com/river) and ![sunset photo](attachment:42).',
      'Back to [[2026-11-01#2]] and [[2026-10-03]], via www.example.org or <https://example.net>.',
      'Mail marie@example.com <br> &nbsp;',
      '```',
      'const forest = 1;',
      '```',
      'Inline `orchard` code.',
    ].join('\n');

    expect(entryWords(content)).toEqual([
      'morning', 'walk', 'bread', 'shop', 'quote', 'see', 'river', 'mail', 'inline', 'code',
    ]);
  });

  it('leaves out numbers, words with digits and single letters, and splits words joined by a hyphen', () => {
    expect(entryWords('In 2026, 3rd time at 10h30 — 1er mai, H2O x y z.')).toEqual(['time', 'mai']);
    expect(entryWords('Grand-mère, peut-être, week-end ; a-t-il vu ?')).toEqual(['grand', 'mère', 'week', 'end', 'vu']);
  });

  it('reads an empty text as no words', () => {
    expect(entryWords('')).toEqual([]);
    expect(entryWords('   \n ')).toEqual([]);
  });
});

describe('topWords', () => {
  it('ranks words by uses across the texts, then alphabetically, from two uses and at most the limit', () => {
    const contents = [
      'Garden, garden and the école. Rain.',
      'Le jardin, la pluie et l’école. Garden.',
      'Ecole, rain, jardin, lune.',
    ];

    expect(topWords(contents, 10, 2)).toEqual([
      { word: 'garden', count: 3 },
      { word: 'école', count: 2 },
      { word: 'jardin', count: 2 },
      { word: 'rain', count: 2 },
    ]);
    expect(topWords(contents, 2, 2)).toEqual([{ word: 'garden', count: 3 }, { word: 'école', count: 2 }]);
    expect(topWords(contents, 10, 4)).toEqual([]);
    expect(topWords([], 10, 2)).toEqual([]);
  });
});

describe('STOP_WORDS', () => {
  it('holds each word in the form the tokenizer checks: lower case with straight apostrophes', () => {
    for (const word of STOP_WORDS) {
      expect(word).toBe(word.toLocaleLowerCase(['en', 'fr']).normalize('NFC'));
      expect(word).not.toMatch(/[’\s]/);
    }
    expect(STOP_WORDS.has("aujourd'hui")).toBe(true);
    expect(STOP_WORDS.has("don't")).toBe(true);
  });
});
