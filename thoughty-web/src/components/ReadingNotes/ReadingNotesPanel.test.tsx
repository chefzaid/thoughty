import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTranslation } from '../../utils/translations';
import { openReadingBook } from './readingBook';
import { ReadingBookError, type ReadingBook } from './readingBookTypes';
import { loadReadingNotes, storeReadingNotes } from './readingNotesStorage';
import { ReadingNotesPanel } from './ReadingNotesPanel';

const service = { importEntries: vi.fn() };

vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => service }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 7 } }) }));
vi.mock('./readingBook', () => ({ openReadingBook: vi.fn() }));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const FINGERPRINT = '0123456789abcdef';
const PAGES = [['I went to the woods because I wished to live deliberately.'], [], ['Our life is frittered away by detail.']];

function book(overrides: Partial<ReadingBook> = {}): ReadingBook {
  return {
    fingerprint: FINGERPRINT,
    format: 'pdf',
    title: 'Walden',
    author: 'Henry David Thoreau',
    sections: PAGES.map((_, index) => ({ kind: 'page' as const, number: index + 1, heading: null })),
    readSection: vi.fn(async (index: number) => PAGES[index] ?? []),
    destroy: vi.fn(async () => undefined),
    ...overrides,
  };
}

function renderPanel() {
  return render(<ReadingNotesPanel diaryId={2} diaryName="Books" isLight={false} language="en" t={t} />);
}

async function openBook(opened = book()) {
  vi.mocked(openReadingBook).mockResolvedValue(opened);
  fireEvent.change(screen.getByLabelText('Open a book (PDF or EPUB)'), { target: { files: [new File(['%PDF-'], 'walden.pdf')] } });
  return screen.findByRole('dialog', { name: 'Walden' });
}

function select(text: Node) {
  const range = document.createRange();
  range.selectNodeContents(text);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  act(() => {
    document.dispatchEvent(new Event('selectionchange'));
  });
}

describe('ReadingNotesPanel', () => {
  beforeEach(() => {
    service.importEntries.mockReset();
    vi.mocked(openReadingBook).mockReset();
  });

  afterEach(() => {
    localStorage.clear();
    document.getSelection()?.removeAllRanges();
  });

  it('opens a book from this device and reads it a page at a time', async () => {
    renderPanel();
    expect(screen.getByText(/each note you save becomes a private entry in Books/)).toBeInTheDocument();

    const dialog = await openBook();
    expect(within(dialog).getByText('Henry David Thoreau')).toBeInTheDocument();
    const page = await within(dialog).findByRole('region', { name: 'Page 1' });
    expect(within(page).getByText(/I went to the woods/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Previous page' })).toBeDisabled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Next page' }));
    expect(await within(dialog).findByText('No text here.')).toBeInTheDocument();
    fireEvent.keyDown(within(dialog).getByRole('region', { name: 'Page 2' }), { key: 'ArrowRight' });
    expect(await within(dialog).findByText('Our life is frittered away by detail.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Next page' })).toBeDisabled();
    // Other keys, and keys with a modifier, leave the page as it is
    fireEvent.keyDown(within(dialog).getByRole('region', { name: 'Page 3' }), { key: 'ArrowLeft', ctrlKey: true });
    fireEvent.keyDown(within(dialog).getByRole('region', { name: 'Page 3' }), { key: 'a' });
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Go to' }), { target: { value: '0' } });
    expect(await within(dialog).findByRole('region', { name: 'Page 1' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('takes a note on the selected passage, changes and removes notes, and keeps them on this device', async () => {
    renderPanel();
    const dialog = await openBook();
    const paragraph = await within(dialog).findByText(/I went to the woods/);

    select(paragraph.firstChild!);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add a note on the selected passage' }));
    const form = within(dialog).getByRole('form', { name: 'New note' });
    expect(within(form).getByLabelText('Passage (optional)')).toHaveValue('I went to the woods because I wished to live deliberately.');
    expect(within(form).getByLabelText('Your note')).toHaveFocus();
    fireEvent.change(within(form).getByLabelText('Your note'), { target: { value: 'So did I, in the mountains.' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Keep the note' }));

    expect(within(dialog).getByRole('heading', { name: '1 note' })).toBeInTheDocument();
    expect(within(dialog).getByText('So did I, in the mountains.')).toBeInTheDocument();
    expect(loadReadingNotes(7)[FINGERPRINT]!.notes[0]).toEqual(expect.objectContaining({ note: 'So did I, in the mountains.', section: { kind: 'page', number: 1, heading: null } }));

    // A note on the page, without a passage; an empty one cannot be kept
    document.getSelection()!.removeAllRanges();
    act(() => {
      document.dispatchEvent(new Event('selectionchange'));
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next page' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Add a note' }));
    const pageForm = within(dialog).getByRole('form', { name: 'New note' });
    expect(within(pageForm).getByText('Page 2')).toBeInTheDocument();
    expect(within(pageForm).getByRole('button', { name: 'Keep the note' })).toBeDisabled();
    fireEvent.change(within(pageForm).getByLabelText('Your note'), { target: { value: 'A blank page.' } });
    fireEvent.click(within(pageForm).getByRole('button', { name: 'Keep the note' }));
    expect(within(dialog).getByRole('heading', { name: '2 notes' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit the note (Page 2)' }));
    const editForm = within(dialog).getByRole('form', { name: 'Change the note' });
    fireEvent.change(within(editForm).getByLabelText('Your note'), { target: { value: 'An empty page.' } });
    fireEvent.click(within(editForm).getByRole('button', { name: 'Keep the note' }));
    expect(within(dialog).getByText('An empty page.')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit the note (Page 2)' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(within(dialog).queryByRole('form')).not.toBeInTheDocument();

    // The note's place in the list goes back to its page
    fireEvent.click(within(dialog).getByRole('button', { name: 'Page 1' }));
    expect(await within(dialog).findByRole('region', { name: 'Page 1' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove the note (Page 2)' }));
    expect(within(dialog).getByRole('heading', { name: '1 note' })).toBeInTheDocument();
    expect(loadReadingNotes(7)[FINGERPRINT]!.notes).toHaveLength(1);
  });

  it('saves the notes to the page’s diary and says why when it cannot', async () => {
    storeReadingNotes(7, { [FINGERPRINT]: { title: 'Walden', author: null, notes: [{
      id: '3f2b8c1e-5a4d-4e2f-9b7a-1c2d3e4f5a6b', quote: 'Simplify, simplify.', note: '', section: { kind: 'page', number: 3, heading: null }, date: '2026-11-20', timeOfDay: '21:15',
    }] } });
    renderPanel();
    const dialog = await openBook();
    expect(within(dialog).getByText('Simplify, simplify.')).toBeInTheDocument();

    service.importEntries.mockResolvedValueOnce({ ok: false, error: 'apiError_DIARY_NOT_FOUND', status: 404 });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save the notes to Books' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The notes could not be saved:');
    expect(service.importEntries).toHaveBeenCalledWith(expect.objectContaining({ source: 'reading-notes', diaryId: 2 }));

    service.importEntries.mockResolvedValueOnce({ ok: true, data: { entries: [], importedCount: 1, alreadyImportedCount: 0, createdDiaries: [] } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save the notes to Books' }));
    expect(await within(dialog).findByText('1 note saved to Books.')).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: '0 notes' })).toBeInTheDocument();
    expect(within(dialog).getByText('No notes on this book yet.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save the notes to Books' })).toBeDisabled();
    expect(loadReadingNotes(7)).toEqual({});
  });

  it('lists the books with notes not saved yet, to save or discard without opening them', async () => {
    const note = { quote: '', note: 'Read again', section: { kind: 'chapter' as const, number: 1, heading: null }, date: '2026-11-20', timeOfDay: '21:15' };
    storeReadingNotes(7, {
      [FINGERPRINT]: { title: 'Walden', author: null, notes: [{ ...note, id: '3f2b8c1e-5a4d-4e2f-9b7a-1c2d3e4f5a6b' }] },
      fedcba9876543210: { title: 'Emma', author: null, notes: [{ ...note, id: '4f2b8c1e-5a4d-4e2f-9b7a-1c2d3e4f5a6b' }, { ...note, id: '5f2b8c1e-5a4d-4e2f-9b7a-1c2d3e4f5a6b' }] },
    });
    renderPanel();
    const list = screen.getByRole('list', { name: 'Notes not saved to your journal yet' });
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Walden · 1 note'),
      expect.stringContaining('Emma · 2 notes'),
    ]);

    service.importEntries.mockResolvedValueOnce({ ok: true, data: { entries: [], importedCount: 1, alreadyImportedCount: 0, createdDiaries: [] } });
    fireEvent.click(within(within(list).getAllByRole('listitem')[0]!).getByRole('button', { name: 'Save to the journal' }));
    expect(await screen.findByText('1 note saved to Books.')).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('list', { name: 'Notes not saved to your journal yet' })).getByRole('button', { name: 'Discard' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Discard these notes?' });
    expect(confirm).toHaveTextContent('The notes on “Emma”');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('list', { name: 'Notes not saved to your journal yet' })).not.toBeInTheDocument();
    expect(loadReadingNotes(7)).toEqual({});
  });

  it('says why a book cannot be opened, and that a page could not be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderPanel();
    const input = screen.getByLabelText('Open a book (PDF or EPUB)');
    const cases: Array<[unknown, string]> = [
      [new ReadingBookError('unsupported'), 'This file is not a PDF or EPUB book.'],
      [new ReadingBookError('tooLarge'), 'This book is larger than 100 MB, too large to read here.'],
      [new ReadingBookError('protected'), 'This book is protected against copying (DRM), so its text cannot be read here.'],
      [new ReadingBookError('empty'), 'This book has no text to read (it may hold only scanned pictures).'],
      [new Error('unexpected'), 'This book could not be read. It may be damaged or protected by a password.'],
    ];
    for (const [error, message] of cases) {
      vi.mocked(openReadingBook).mockRejectedValueOnce(error);
      fireEvent.change(input, { target: { files: [new File(['x'], 'book.pdf')] } });
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
    }
    // No file chosen changes nothing
    fireEvent.change(input, { target: { files: [] } });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    const dialog = await openBook(book({ readSection: vi.fn(async () => { throw new Error('bad page'); }) }));
    expect(await within(dialog).findByText('This part of the book could not be read.')).toBeInTheDocument();
  });

  it('frees the open book when the page goes', async () => {
    const opened = book();
    const { unmount } = renderPanel();
    await openBook(opened);
    unmount();
    await waitFor(() => expect(opened.destroy).toHaveBeenCalled());
  });
});
