import { afterEach, describe, expect, it, vi } from 'vitest';

import { forgetLocalReadingNotes, loadReadingNotes, storeReadingNotes, type ReadingNote } from './readingNotesStorage';

const FINGERPRINT = '0123456789abcdef';
const note = (overrides: Partial<ReadingNote> = {}): ReadingNote => ({
  id: '3f2b8c1e-5a4d-4e2f-9b7a-1c2d3e4f5a6b',
  quote: 'What is essential is invisible to the eye.',
  note: 'The fox was right.',
  section: { kind: 'chapter', number: 21, heading: 'XXI' },
  date: '2026-11-20',
  timeOfDay: '21:15',
  ...overrides,
});

describe('readingNotesStorage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('keeps each writer’s notes apart and leaves nothing behind once a writer has none', () => {
    const store = { [FINGERPRINT]: { title: 'The Little Prince', author: null, notes: [note()] } };
    storeReadingNotes(7, store);
    storeReadingNotes(8, {});

    expect(loadReadingNotes(7)).toEqual(store);
    expect(loadReadingNotes(8)).toEqual({});
    expect(localStorage.getItem('thoughty.readingNotes.8')).toBeNull();

    storeReadingNotes(7, { [FINGERPRINT]: { title: 'The Little Prince', author: null, notes: [] } });
    expect(localStorage.getItem('thoughty.readingNotes.7')).toBeNull();
  });

  it('reads back only well-formed books and notes', () => {
    localStorage.setItem('thoughty.readingNotes.7', JSON.stringify({
      [FINGERPRINT]: { title: 'Kept', author: 'A. Writer', notes: [note(), note({ id: 'not-a-uuid' }), note({ date: 'yesterday' }), note({ section: { kind: 'page', number: 0, heading: null } }), { id: 1 }] },
      fedcba9876543210: { title: 'Only bad notes', author: null, notes: [note({ timeOfDay: '9pm' })] },
      'not-a-fingerprint': { title: 'Ignored', author: null, notes: [note()] },
      '1111222233334444': { title: 3, author: null, notes: [] },
      '5555666677778888': 'text',
    }));

    expect(loadReadingNotes(7)).toEqual({ [FINGERPRINT]: { title: 'Kept', author: 'A. Writer', notes: [note()] } });

    localStorage.setItem('thoughty.readingNotes.7', '{broken');
    expect(loadReadingNotes(7)).toEqual({});
    localStorage.setItem('thoughty.readingNotes.7', '"text"');
    expect(loadReadingNotes(7)).toEqual({});
  });

  it('forgets every writer’s notes on this device and nothing else, and copes with blocked storage', () => {
    storeReadingNotes(7, { [FINGERPRINT]: { title: 'A', author: null, notes: [note()] } });
    storeReadingNotes(8, { [FINGERPRINT]: { title: 'B', author: null, notes: [note()] } });
    localStorage.setItem('thoughty.theme', 'dark');

    forgetLocalReadingNotes();

    expect(loadReadingNotes(7)).toEqual({});
    expect(loadReadingNotes(8)).toEqual({});
    expect(localStorage.getItem('thoughty.theme')).toBe('dark');

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => storeReadingNotes(7, { [FINGERPRINT]: { title: 'A', author: null, notes: [note()] } })).not.toThrow();
    expect(() => forgetLocalReadingNotes()).not.toThrow();
  });
});
