import { describe, expect, it } from 'vitest';
import { getTranslation } from '../../utils/translations';
import { canReplyToEntry, entryReference, entryReplyDraft, replyLabel, replyQuote, REPLY_QUOTE_LENGTH } from './entryReply';

const NOW = new Date(2026, 10, 1, 9, 30);

describe('replyQuote', () => {
  it('takes the first sentence of the first paragraph, closing quote included', () => {
    expect(replyQuote('Walked to the lake. It was cold!\nThen home.')).toBe('Walked to the lake.');
    expect(replyQuote('She said “go.” So I went.')).toBe('She said “go.”');
    expect(replyQuote('Pourquoi ? Je ne sais pas.')).toBe('Pourquoi ?');
    expect(replyQuote('It cost 3.50 today… mostly fine')).toBe('It cost 3.50 today…');
    expect(replyQuote('No full stop here\nsecond line')).toBe('No full stop here');
  });

  it('drops Markdown syntax, task boxes, pictures and entry links before quoting', () => {
    expect(replyQuote('# Plans\n\nSee **this** [[2024-01-02]].', 'markdown')).toBe('Plans');
    expect(replyQuote('- [x] Called ![Mum](attachment:4) about [[2024-01-02#2]]. Done', 'markdown')).toBe('Called Mum about 2024-01-02#2.');
  });

  it('cuts a long sentence on a word with an ellipsis, and a long word on a character', () => {
    const words = Array.from({ length: 60 }, (_, index) => `word${index}`).join(' ');
    const quote = replyQuote(words);
    expect(quote.endsWith('…')).toBe(true);
    expect(quote.length).toBeLessThanOrEqual(REPLY_QUOTE_LENGTH + 1);
    expect(words.startsWith(quote.slice(0, -1))).toBe(true);
    expect(words.charAt(quote.length - 1)).toBe(' ');

    expect(replyQuote('x'.repeat(250))).toBe(`${'x'.repeat(REPLY_QUOTE_LENGTH)}…`);
    // A word ending right at the limit is kept whole, without the comma after it
    expect(replyQuote(`${'a'.repeat(199)}, and more`)).toBe(`${'a'.repeat(199)}…`);
    expect(replyQuote('')).toBe('');
  });
});

describe('entryReplyDraft', () => {
  const entry = { content: 'Started pottery. Loved it.', date: '2024-03-04T00:00:00.000Z', index: 2 };

  it('quotes a plain entry in the language’s quotation marks, then links to it', () => {
    expect(entryReplyDraft(entry, 'en')).toEqual({ text: '“Started pottery.” — [[2024-03-04#2]]\n\n', format: 'plain' });
    expect(entryReplyDraft({ ...entry, format: 'plain' }, 'fr')?.text).toBe('« Started pottery. » — [[2024-03-04#2]]\n\n');
  });

  it('quotes a Markdown entry as a blockquote with the link below it', () => {
    expect(entryReplyDraft({ ...entry, format: 'markdown' }, 'en')).toEqual({
      text: '> Started pottery.\n\n— [[2024-03-04#2]]\n\n',
      format: 'markdown',
    });
  });

  it('links alone when there is nothing to quote, and gives nothing for a sealed time capsule', () => {
    expect(entryReplyDraft({ ...entry, content: '![](attachment:3)', format: 'markdown' }, 'en')?.text).toBe('[[2024-03-04#2]]\n\n');
    expect(entryReplyDraft({ ...entry, sealed_until: '2030-01-01T00:00:00Z' }, 'en')).toBeNull();
  });

  it('links to entry #1 when the entry has no number', () => {
    expect(entryReference({ date: '2024-03-04' })).toBe('[[2024-03-04#1]]');
  });
});

describe('canReplyToEntry', () => {
  it('offers a reply on entries before the writer’s today only, never on a sealed time capsule', () => {
    expect(canReplyToEntry({ date: '2026-10-31' }, NOW)).toBe(true);
    expect(canReplyToEntry({ date: '2020-01-01T00:00:00.000Z' }, NOW)).toBe(true);
    expect(canReplyToEntry({ date: '2026-11-01' }, NOW)).toBe(false);
    expect(canReplyToEntry({ date: '2026-12-25' }, NOW)).toBe(false);
    expect(canReplyToEntry({ date: '2026-10-31', sealed_until: '2027-01-01T00:00:00Z' }, NOW)).toBe(false);
  });
});

describe('replyLabel', () => {
  it('names the entry by its date, and its number on a day of several, in English and French', () => {
    const en = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
    const fr = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);
    expect(replyLabel({ date: '2024-03-04', index: 1 }, 'en', en)).toBe('Write a reply to the entry of March 4, 2024');
    expect(replyLabel({ date: '2024-03-04', index: 2 }, 'en', en)).toBe('Write a reply to entry 2 of March 4, 2024');
    expect(replyLabel({ date: '2024-03-04' }, 'fr', fr)).toBe("Écrire une réponse à l'entrée du 4 mars 2024");
    expect(replyLabel({ date: '2024-03-04', index: 3 }, 'fr', fr)).toBe("Écrire une réponse à l'entrée 3 du 4 mars 2024");
  });
});
