import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';

import RandomEntryButton from './RandomEntryButton';
import type { EntryListQuery } from '../../services/api/entryListQuery';
import { getTranslation, type Language } from '../../utils/translations';

const randomService = vi.hoisted(() => ({ pick: vi.fn() }));
vi.mock('../../hooks/useAuthenticatedService', () => ({
  useAuthenticatedService: () => randomService,
}));

const baseQuery: EntryListQuery = {
  page: 1, limit: 10, search: '', filterTags: ['walks'], filterDate: '', filterVisibility: '',
  favorites: false, archiveStatus: 'active', diaryId: null, entryIds: null,
};

/** The button inside a journal whose page and tags can change, as the list's own query does. */
function Harness({ listEmpty = false, language = 'en' as Language, onOpen, onNotify }: {
  listEmpty?: boolean;
  language?: Language;
  onOpen: (entryId: number, page: number) => void;
  onNotify: (message: string) => void;
}) {
  const [query, setQuery] = useState(baseQuery);
  return (
    <>
      <RandomEntryButton
        query={query}
        listEmpty={listEmpty}
        onOpen={(entryId, page) => { setQuery((current) => ({ ...current, page })); onOpen(entryId, page); }}
        onNotify={onNotify}
        language={language}
        theme="light"
        t={(key, params) => getTranslation(language, key, params)}
      />
      <button type="button" onClick={() => setQuery((current) => ({ ...current, filterTags: ['river'] }))}>Change filter</button>
    </>
  );
}

describe('RandomEntryButton', () => {
  const onOpen = vi.fn();
  const onNotify = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens an entry picked among the filters on its page, then offers another one that moves on', async () => {
    randomService.pick
      .mockResolvedValueOnce({ data: { id: 7, date: '2024-03-10', index: 1, page: 3 }, error: null })
      .mockResolvedValueOnce({ data: { id: 9, date: '2023-12-01', index: 2, page: 1 }, error: null });
    render(<Harness onOpen={onOpen} onNotify={onNotify} />);

    const button = screen.getByRole('button', { name: 'Random entry' });
    expect(button).toHaveAccessibleDescription('Open an entry picked at random among the current filters');
    fireEvent.click(button);

    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(7, 3));
    expect(randomService.pick).toHaveBeenCalledWith(baseQuery, null);
    expect(screen.getByText('Showing a random entry from Mar 10, 2024.')).toBeInTheDocument();

    // The page moved to the pick, but the filters did not, so it is another pick among them
    fireEvent.click(screen.getByRole('button', { name: 'Another one' }));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(9, 1));
    expect(randomService.pick).toHaveBeenLastCalledWith({ ...baseQuery, page: 3 }, 7);
  });

  it('starts afresh when the filters change', async () => {
    randomService.pick.mockResolvedValue({ data: { id: 7, date: '2024-03-10', index: 1, page: 1 }, error: null });
    render(<Harness onOpen={onOpen} onNotify={onNotify} />);

    fireEvent.click(screen.getByRole('button', { name: 'Random entry' }));
    await screen.findByRole('button', { name: 'Another one' });
    fireEvent.click(screen.getByRole('button', { name: 'Change filter' }));

    fireEvent.click(screen.getByRole('button', { name: 'Random entry' }));
    await waitFor(() => expect(randomService.pick).toHaveBeenCalledTimes(2));
    expect(randomService.pick).toHaveBeenLastCalledWith(expect.objectContaining({ filterTags: ['river'] }), null);
  });

  it('says why it cannot pick when the filtered list is empty, and picks nothing', () => {
    render(<Harness listEmpty onOpen={onOpen} onNotify={onNotify} language="fr" />);

    const button = screen.getByRole('button', { name: 'Entrée au hasard' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('Aucune entrée ne correspond à ces filtres : il n’y a rien à tirer au sort.');
    fireEvent.click(button);
    expect(randomService.pick).not.toHaveBeenCalled();
  });

  it('shows the reason in the notice when nothing could be picked, and ignores clicks while it asks', async () => {
    let answer: (value: unknown) => void = () => undefined;
    randomService.pick.mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }));
    render(<Harness onOpen={onOpen} onNotify={onNotify} />);

    const button = screen.getByRole('button', { name: 'Random entry' });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(randomService.pick).toHaveBeenCalledTimes(1);

    answer({ data: null, error: 'apiError_ENTRY_RANDOM_NO_MATCH' });
    await waitFor(() => expect(onNotify).toHaveBeenCalledWith('No entry matches these filters, so there is nothing to pick from.'));
    expect(onOpen).not.toHaveBeenCalled();
    expect(button).toHaveAttribute('aria-disabled', 'false');

    randomService.pick.mockResolvedValueOnce({ data: null, error: null });
    fireEvent.click(button);
    await waitFor(() => expect(onNotify).toHaveBeenLastCalledWith('No entry could be picked right now. Try again.'));
  });
});
