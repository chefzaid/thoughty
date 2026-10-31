import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import EntryViewMode from './EntryViewMode';
import { createEntryViewModeProps, mockEntries } from './EntriesList.test-utils';
import { getTranslation } from '../../utils/translations';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

describe('EntryViewMode printing', () => {
    it('opens the print options from More actions, and gives focus back when closed', async () => {
        const user = userEvent.setup();
        const entry = { ...mockEntries[0], title: 'A walk by the sea' };
        render(<EntryViewMode {...createEntryViewModeProps({ entry, t })} />);

        await user.click(screen.getByRole('button', { name: 'More actions' }));
        await user.click(screen.getByRole('menuitem', { name: 'Print' }));

        const dialog = screen.getByRole('dialog', { name: 'Print this entry' });
        expect(dialog).toHaveTextContent('January 15, 2024 · A walk by the sea');
        expect(within(dialog).getByRole('checkbox', { name: 'Tags' })).toBeChecked();
        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('button', { name: 'More actions' })).toHaveFocus());
    });
});
