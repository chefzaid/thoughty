import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTranslation } from '../../utils/translations';
import { loadReadingNotes, storeReadingNotes, type ReadingNote } from './readingNotesStorage';
import { useReadingNotes, type ReadingNotesService } from './useReadingNotes';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const FINGERPRINT = '0123456789abcdef';
const BOOK = { title: 'Walden', author: 'Henry David Thoreau' };
const PAGE = { kind: 'page' as const, number: 3, heading: null };

const savedNote = (index: number): ReadingNote => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  quote: `Passage ${index}`,
  note: '',
  section: PAGE,
  date: '2026-11-20',
  timeOfDay: '08:00',
});

function setup(service: ReadingNotesService['importEntries'] = vi.fn()) {
  const importEntries = vi.mocked(service);
  const hook = renderHook(({ userId }) => useReadingNotes(userId, { importEntries }, t), { initialProps: { userId: 7 as number | null } });
  return { importEntries, ...hook };
}

describe('useReadingNotes', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 20, 21, 15));
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('adds, changes and removes notes on a book, dated now, trimmed and kept on this device', () => {
    const { result } = setup();

    act(() => result.current.addNote(FINGERPRINT, BOOK, { quote: '  I went to the woods ', note: ' Me too ', section: PAGE }));
    const [added] = result.current.store[FINGERPRINT]!.notes;
    expect(added).toEqual(expect.objectContaining({ quote: 'I went to the woods', note: 'Me too', section: PAGE, date: '2026-11-20', timeOfDay: '21:15' }));
    expect(added!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(loadReadingNotes(7)).toEqual({ [FINGERPRINT]: { ...BOOK, notes: [added] } });

    act(() => result.current.updateNote(FINGERPRINT, added!.id, { quote: 'I went to the woods', note: 'To live deliberately' }));
    expect(result.current.store[FINGERPRINT]!.notes[0]!.note).toBe('To live deliberately');

    act(() => result.current.removeNote(FINGERPRINT, added!.id));
    expect(result.current.store).toEqual({});
    expect(loadReadingNotes(7)).toEqual({});

    // Changing a note of a book with none does nothing
    act(() => result.current.updateNote(FINGERPRINT, added!.id, { quote: '', note: 'x' }));
    expect(result.current.store).toEqual({});
  });

  it('reads the signed-in writer’s notes and none without a writer, and discards a book’s notes', () => {
    storeReadingNotes(7, { [FINGERPRINT]: { ...BOOK, notes: [savedNote(1)] } });
    const { result, rerender } = setup();
    expect(result.current.store[FINGERPRINT]!.notes).toHaveLength(1);

    act(() => result.current.discardBook(FINGERPRINT));
    expect(result.current.store).toEqual({});

    rerender({ userId: null });
    act(() => result.current.addNote(FINGERPRINT, BOOK, { quote: 'Kept for this visit only', note: '', section: PAGE }));
    expect(result.current.store[FINGERPRINT]!.notes).toHaveLength(1);
    expect(localStorage.length).toBe(0);
  });

  it('saves the notes as reading-notes entries in the diary, 200 to a request, and keeps those that could not be saved', async () => {
    const notes = Array.from({ length: 250 }, (_, index) => savedNote(index));
    storeReadingNotes(7, { [FINGERPRINT]: { ...BOOK, notes } });
    const importEntries = vi.fn<ReadingNotesService['importEntries']>()
      .mockResolvedValueOnce({ ok: true, data: { entries: [], importedCount: 200, alreadyImportedCount: 0, createdDiaries: [] } })
      .mockResolvedValueOnce({ ok: false, error: 'apiError_RATE_LIMITED', status: 429 });
    const { result } = setup(importEntries);

    let outcome: Awaited<ReturnType<typeof result.current.saveBook>> | undefined;
    await act(async () => {
      outcome = await result.current.saveBook(FINGERPRINT, 4);
    });

    expect(outcome).toEqual({ ok: false, saved: 200, error: 'apiError_RATE_LIMITED' });
    expect(importEntries).toHaveBeenCalledTimes(2);
    const first = importEntries.mock.calls[0]![0];
    expect(first).toEqual(expect.objectContaining({ source: 'reading-notes', diaryId: 4 }));
    expect(first.entries).toHaveLength(200);
    expect(first.entries[0]).toEqual(expect.objectContaining({ sourceId: `${FINGERPRINT}/${notes[0]!.id}`, title: 'Walden', date: '2026-11-20', timeOfDay: '08:00' }));
    expect(importEntries.mock.calls[1]![0].entries).toHaveLength(50);
    expect(result.current.store[FINGERPRINT]!.notes).toEqual(notes.slice(200));

    importEntries.mockResolvedValueOnce({ ok: true, data: { entries: [], importedCount: 50, alreadyImportedCount: 0, createdDiaries: [] } });
    await act(async () => {
      outcome = await result.current.saveBook(FINGERPRINT, null);
    });
    expect(outcome).toEqual({ ok: true, saved: 50 });
    expect(importEntries.mock.calls[2]![0].diaryId).toBeUndefined();
    expect(result.current.store).toEqual({});

    await act(async () => {
      outcome = await result.current.saveBook(FINGERPRINT, 4);
    });
    expect(outcome).toEqual({ ok: true, saved: 0 });
    expect(importEntries).toHaveBeenCalledTimes(3);
  });
});
