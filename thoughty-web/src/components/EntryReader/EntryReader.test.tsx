import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EntryReaderPage } from '../../services/api/entryReaderService';
import type { Config, Entry } from '../../types';
import { createTestQueryClient } from '../../test/queryClient';
import { getTranslation } from '../../utils/translations';
import { QuietModeContext } from '../QuietMode/quietMode';
import EntryReader from './EntryReader';

const readerService = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => readerService }));
vi.mock('../AttachmentDisplay/AttachmentDisplay', () => ({
  default: ({ attachments }: { attachments: { original_filename: string }[] }) => (
    <ul data-testid="attachments">{attachments.map((file) => <li key={file.original_filename}>{file.original_filename}</li>)}</ul>
  ),
}));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const fr = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);

const entry = (id: number, date: string, fields: Partial<Entry> = {}): Entry => ({
  id, date, index: 1, content: `Entry ${id} text`, tags: ['walks'], visibility: 'private', diary_id: 1, ...fields,
});
const PAGES: Record<number, EntryReaderPage> = {
  1: { entry: entry(1, '2024-03-10', { title: 'Harbor', time_of_day: '07:30' }), previousId: null, nextId: 2, position: 1, total: 3 },
  2: {
    entry: entry(2, '2024-03-11', {
      format: 'markdown',
      content: '**Bold** words',
      attachments: [{ id: 5, original_filename: 'ticket.pdf', stored_filename: 's.pdf', mimetype: 'application/pdf', size: 10 }],
    }),
    previousId: 1,
    nextId: 3,
    position: 2,
    total: 3,
  },
  3: { entry: entry(3, '2024-03-12'), previousId: 2, nextId: null, position: 3, total: 3 },
};

interface HarnessProps {
  readonly initialEntryId?: number | null;
  readonly config?: Config;
  readonly quiet?: boolean;
  readonly language?: 'en' | 'fr';
  readonly onShow?: (entryId: number | null) => void;
  readonly onClose?: () => void;
}

function Harness({ initialEntryId = null, config = { theme: 'dark', language: 'en' }, quiet = false, language = 'en', onShow, onClose }: HarnessProps) {
  const [entryId, setEntryId] = useState<number | null>(initialEntryId);
  const [open, setOpen] = useState(true);
  return (
    <QuietModeContext.Provider value={quiet}>
      <button type="button" data-entry-reader-trigger="">Read</button>
      {open && (
        <EntryReader
          scope="tags=walks"
          entryId={entryId}
          onShow={(id) => { onShow?.(id); setEntryId(id); }}
          onClose={() => { onClose?.(); setOpen(false); }}
          config={{ ...config, language }}
          t={language === 'fr' ? fr : t}
        />
      )}
    </QuietModeContext.Provider>
  );
}

function renderReader(props: HarnessProps = {}) {
  return render(<QueryClientProvider client={createTestQueryClient()}><Harness {...props} /></QueryClientProvider>);
}

const status = () => document.querySelector('.entry-reader [aria-live="polite"]');
const button = (name: string) => screen.getByRole('button', { name });

describe('EntryReader', () => {
  beforeEach(() => {
    readerService.read.mockImplementation(async (_scope: string, id: number | null) => ({ data: PAGES[id ?? 1], error: null }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.documentElement.className = '';
  });

  it('opens on the first entry, puts its ID in the address, and shows only its day, title and text', async () => {
    const onShow = vi.fn();
    renderReader({ onShow });

    const dialog = screen.getByRole('dialog', { name: 'Reader' });
    expect(dialog).toHaveAccessibleDescription('Left and right arrows turn the page. Esc closes.');
    expect(await screen.findByRole('heading', { level: 2, name: /^March 10, 2024 ?, 7:30\sAM$/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Harbor' })).toBeInTheDocument();
    expect(screen.getByText('Entry 1 text').closest('.entry-reader-text')).toHaveClass('privacy-text');
    expect(screen.getByRole('article', { name: /^March 10, 2024 ?, 7:30\sAM$/ })).toBeInTheDocument();
    expect(onShow).toHaveBeenCalledWith(1);
    expect(readerService.read).toHaveBeenCalledWith('tags=walks', null);
    // Nothing to edit, tag or count: the close button and the two page buttons only
    expect(screen.getAllByRole('button').filter((control) => dialog.contains(control)).map((control) => control.textContent))
      .toEqual(['Close', '‹ Previous', 'Next ›']);
    expect(screen.queryByText('walks')).not.toBeInTheDocument();
    expect(status()).toHaveTextContent('Entry 1 of 3, March 10, 2024.');
    // The neighbour is read ahead
    await waitFor(() => expect(readerService.read).toHaveBeenCalledWith('tags=walks', 2));
    expect(document.activeElement).toHaveClass('entry-reader-page');
  });

  it('turns the pages with the buttons and the arrow keys, and says when there is no page further', async () => {
    renderReader({ initialEntryId: 1 });
    await screen.findByText('Entry 1 text');
    expect(button('Previous')).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(button('Previous'));
    expect(status()).toHaveTextContent('This is the first entry.');

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
    expect(await screen.findByText('Bold')).toBeInTheDocument();
    expect(screen.getByTestId('attachments')).toHaveTextContent('ticket.pdf');
    expect(status()).toHaveTextContent('Entry 2 of 3, March 11, 2024.');

    fireEvent.click(button('Next'));
    await screen.findByText('Entry 3 text');
    expect(button('Next')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
    expect(status()).toHaveTextContent('This is the last entry.');

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowLeft' });
    await screen.findByText('Bold');
    // With a modifier, the arrows are the browser's
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowLeft', altKey: true });
    expect(screen.getByText('Bold')).toBeInTheDocument();
  });

  it('keeps the journal shortcuts from acting behind it, but not Esc, which closes it and gives focus back', async () => {
    const onClose = vi.fn();
    const journalKeys = vi.fn();
    document.addEventListener('keydown', journalKeys);
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    renderReader({ initialEntryId: 1, onClose });
    await screen.findByText('Entry 1 text');

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'n', ctrlKey: true });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' });
    expect(journalKeys).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
    document.removeEventListener('keydown', journalKeys);
    opener.remove();
  });

  it("gives focus to the journal's Read button after a reload, when nothing opened it", async () => {
    (document.activeElement as HTMLElement | null)?.blur();
    renderReader({ initialEntryId: 1 });
    await screen.findByText('Entry 1 text');

    fireEvent.click(button('Close'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Read' }));
  });

  it('announces the day alone in quiet mode, and speaks French', async () => {
    renderReader({ initialEntryId: 1, quiet: true, language: 'fr' });

    expect(await screen.findByRole('heading', { level: 2, name: /^10 mars 2024 ?, 0?7:30$/ })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Lecture' })).toHaveAttribute('lang', 'fr');
    expect(status()).toHaveTextContent(/^10 mars 2024\.$/);
    expect(button('Suivante')).toBeInTheDocument();
  });

  it('reads in a book serif, or the font the writer chose, larger than the journal', async () => {
    const { unmount } = renderReader({ initialEntryId: 1, config: { theme: 'light', language: 'en', fontSize: 20 } });
    await screen.findByText('Entry 1 text');
    const sheet = () => document.querySelector<HTMLElement>('.entry-reader-sheet')!;
    expect(sheet().style.fontFamily).toContain('Georgia');
    expect(sheet().style.fontSize).toBe('24px');
    expect(screen.getByRole('dialog')).toHaveClass('light');
    unmount();

    renderReader({ initialEntryId: 1, config: { theme: 'dark', language: 'en', fontFamily: 'mono' } });
    await screen.findByText('Entry 1 text');
    expect(sheet().style.fontFamily).toContain('monospace');
  });

  it('marks the page for printing and holds it still while open', async () => {
    const { unmount } = renderReader({ initialEntryId: 1 });
    await screen.findByText('Entry 1 text');
    expect(document.documentElement).toHaveClass('entry-reader-active');
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement).not.toHaveClass('entry-reader-active');
    expect(document.body.style.overflow).toBe('');
  });

  it('offers to start over when the entry is no longer read', async () => {
    readerService.read.mockImplementation(async (_scope: string, id: number | null) => (
      id === 7 ? { data: null, error: 'apiError_ENTRY_READER_NOT_FOUND' } : { data: PAGES[id ?? 1], error: null }
    ));
    const onShow = vi.fn();
    renderReader({ initialEntryId: 7, onShow });

    expect(await screen.findByRole('alert')).toHaveTextContent('This entry is not among the entries being read any more.');
    fireEvent.click(button('Start from the first entry'));
    expect(onShow).toHaveBeenCalledWith(null);
    expect(await screen.findByText('Entry 1 text')).toBeInTheDocument();
    expect(onShow).toHaveBeenLastCalledWith(1);
  });

  it('tries again when loading fails', async () => {
    readerService.read.mockResolvedValue({ data: null, error: 'readerLoadFailed' });
    renderReader({ initialEntryId: 2 });

    expect(await screen.findByRole('alert')).toHaveTextContent('The entry could not be loaded. Try again.');
    readerService.read.mockResolvedValue({ data: PAGES[2], error: null });
    await act(async () => { fireEvent.click(button('Try again')); });
    expect(await screen.findByText('Bold')).toBeInTheDocument();
  });

  it('shows that it is loading before the first entry arrives', () => {
    readerService.read.mockReturnValue(new Promise(() => undefined));
    renderReader();
    expect(screen.getByText('Loading the entry…')).toBeInTheDocument();
    expect(button('Next')).toHaveAttribute('aria-disabled', 'true');
  });
});
