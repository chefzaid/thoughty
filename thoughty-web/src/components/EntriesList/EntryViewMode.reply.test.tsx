import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EntryViewMode from './EntryViewMode';
import { createEntryViewModeProps, formatDate, mockEntries } from './EntriesList.test-utils';
import { getTranslation } from '../../utils/translations';

const en = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const fr = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);

describe('EntryViewMode reply', () => {
    it('offers Write a reply on an older entry, named by its date, and hands the entry over', async () => {
        const user = userEvent.setup();
        const onReply = vi.fn();
        render(<EntryViewMode {...createEntryViewModeProps({ entry: mockEntries[1], onReply, t: en })} />);

        const button = screen.getByRole('button', { name: 'Write a reply to entry 2 of January 15, 2024' });
        expect(button).toHaveAttribute('title', 'Write a reply');
        await user.click(button);
        expect(onReply).toHaveBeenCalledWith(mockEntries[1]);
    });

    it('names the action in French', () => {
        render(<EntryViewMode {...createEntryViewModeProps({ entry: mockEntries[0], config: { theme: 'light', language: 'fr' }, onReply: vi.fn(), t: fr })} />);

        expect(screen.getByRole('button', { name: "Écrire une réponse à l'entrée du 15 janvier 2024" })).toHaveAttribute('title', 'Écrire une réponse');
    });

    it('leaves it out on an entry of today, and without a composer to reply in', () => {
        const today = { ...mockEntries[0], date: formatDate(new Date()) };
        const { rerender } = render(<EntryViewMode {...createEntryViewModeProps({ entry: today, onReply: vi.fn(), t: en })} />);
        expect(screen.queryByRole('button', { name: /Write a reply/ })).not.toBeInTheDocument();

        rerender(<EntryViewMode {...createEntryViewModeProps({ entry: mockEntries[0], t: en })} />);
        expect(screen.queryByRole('button', { name: /Write a reply/ })).not.toBeInTheDocument();
    });

    it('leaves it out on a sealed time capsule', () => {
        const sealed = { ...mockEntries[0], content: '', sealed_until: '2030-01-01T00:00:00Z' };
        render(<EntryViewMode {...createEntryViewModeProps({ entry: sealed, onReply: vi.fn(), t: en })} />);

        expect(screen.queryByRole('button', { name: /Write a reply/ })).not.toBeInTheDocument();
    });

    it('reads the backlinks again when an entry was written meanwhile', async () => {
        const onFetchBacklinks = vi.fn().mockResolvedValue([]);
        const props = createEntryViewModeProps({ entry: mockEntries[0], onFetchBacklinks, backlinksVersion: 0, t: en });
        const { rerender } = render(<EntryViewMode {...props} />);
        await waitFor(() => expect(onFetchBacklinks).toHaveBeenCalledTimes(1));

        rerender(<EntryViewMode {...props} />);
        rerender(<EntryViewMode {...props} backlinksVersion={1} />);
        await waitFor(() => expect(onFetchBacklinks).toHaveBeenCalledTimes(2));
        expect(onFetchBacklinks).toHaveBeenLastCalledWith(mockEntries[0].id);
    });
});
