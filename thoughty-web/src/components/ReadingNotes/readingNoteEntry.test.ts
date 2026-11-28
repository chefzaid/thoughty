import { describe, expect, it } from 'vitest';

import { getTranslation } from '../../utils/translations';
import { readingNoteEntry, sectionLabel } from './readingNoteEntry';
import type { ReadingNote } from './readingNotesStorage';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const fr = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);
const note = (overrides: Partial<ReadingNote> = {}): ReadingNote => ({
  id: '3f2b8c1e-5a4d-4e2f-9b7a-1c2d3e4f5a6b',
  quote: 'What is *essential*\n\n# is invisible to the eye.',
  note: 'The fox was **right**.',
  section: { kind: 'page', number: 12, heading: null },
  date: '2026-11-20',
  timeOfDay: '21:15',
  ...overrides,
});

describe('readingNoteEntry', () => {
  it('quotes the passage as written, then the note, then where it comes from, titled after the book', () => {
    const entry = readingNoteEntry('0123456789abcdef', { title: 'The [Little] Prince', author: 'Antoine de Saint-Exupéry' }, note(), t);

    expect(entry).toEqual({
      sourceId: '0123456789abcdef/3f2b8c1e-5a4d-4e2f-9b7a-1c2d3e4f5a6b',
      date: '2026-11-20',
      timeOfDay: '21:15',
      title: 'The [Little] Prince',
      content: [
        '> What is \\*essential\\*\n>\n> \\# is invisible to the eye.',
        'The fox was **right**.',
        '— *The \\[Little\\] Prince*, Antoine de Saint-Exupéry, page 12',
      ].join('\n\n'),
      tags: [],
    });
  });

  it('leaves out an empty passage or note and an unknown author, and names a chapter by its heading or number', () => {
    const book = { title: 'Walden', author: null };

    expect(readingNoteEntry('0123456789abcdef', book, note({ quote: '  ', section: { kind: 'chapter', number: 2, heading: 'Economy' } }), t).content)
      .toBe('The fox was **right**.\n\n— *Walden*, Economy');
    expect(readingNoteEntry('0123456789abcdef', book, note({ note: '', quote: '1. First', section: { kind: 'chapter', number: 3, heading: null } }), fr).content)
      .toBe('> \\1. First\n\n— *Walden*, chapitre 3');
  });

  it('labels where a note is for its list', () => {
    expect(sectionLabel({ kind: 'page', number: 4, heading: null }, t)).toBe('Page 4');
    expect(sectionLabel({ kind: 'chapter', number: 4, heading: null }, fr)).toBe('Chapitre 4');
    expect(sectionLabel({ kind: 'chapter', number: 4, heading: 'Solitude' }, t)).toBe('Solitude');
  });
});
