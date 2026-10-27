import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntryViewMode from './EntryViewMode';
import { createEntryViewModeProps, mockEntries } from './EntriesList.test-utils';
import { getTranslation } from '../../utils/translations';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const sealed = { ...mockEntries[0], content: '', tags: [], title: null, sealed_until: '2031-10-27T08:00:00.000Z' };

describe('a sealed time capsule in the journal', () => {
    it('shows only a placeholder with when it opens, none of the entry’s actions', () => {
        render(<EntryViewMode {...createEntryViewModeProps({ entry: sealed, t })} />);

        const card = screen.getByRole('region', { name: 'Sealed time capsule' });
        expect(within(card).getByText('Time capsule')).toBeInTheDocument();
        expect(within(card).getByText(/Sealed until October 27, 2031/)).toBeInTheDocument();
        expect(screen.queryByTitle('Edit')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Discuss entry')).not.toBeInTheDocument();
    });

    it('opens early only after the writer confirms', async () => {
        const user = userEvent.setup();
        const onUnseal = vi.fn();
        render(<EntryViewMode {...createEntryViewModeProps({ entry: sealed, onUnseal, t })} />);

        await user.click(screen.getByRole('button', { name: 'Open early' }));
        const dialog = screen.getByRole('alertdialog', { name: 'Open this time capsule now?' });
        expect(dialog).toHaveAccessibleDescription(/It was sealed until October 27, 2031/);
        await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
        expect(onUnseal).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'Open early' }));
        await user.click(screen.getByRole('button', { name: 'Open now' }));
        expect(onUnseal).toHaveBeenCalledWith(sealed);
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('can be deleted, and is in French with its diary', async () => {
        const user = userEvent.setup();
        const onDelete = vi.fn();
        const tFr = (key: string, params?: Record<string, string | number>) => getTranslation('fr', key, params);
        const props = createEntryViewModeProps({ entry: { ...sealed, diary_name: 'Travail', diary_icon: '💼' }, onDelete, t: tFr, showDiaryLabel: true });
        render(<EntryViewMode {...props} config={{ ...props.config, language: 'fr', theme: 'light' }} />);

        expect(screen.getByText(/Scellée jusqu’au 27 octobre 2031/)).toBeInTheDocument();
        expect(screen.getByText(/Travail/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Ouvrir maintenant' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Supprimer' }));
        expect(onDelete).toHaveBeenCalledWith(sealed.id);
    });
});
