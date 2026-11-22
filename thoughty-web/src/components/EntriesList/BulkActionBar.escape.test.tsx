import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FeatureFlagsContext } from '../FeatureFlags/featureFlags';
import { getTranslation } from '../../utils/translations';
import { BulkActionBar } from './BulkActionBar';

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);

function renderBar(onBulkAction = vi.fn()) {
    render(
        <FeatureFlagsContext.Provider value={{ ai: true }}>
            <BulkActionBar
                selectedCount={1}
                allTags={['running', 'reading', 'archive']}
                tagMetadata={{}}
                diaries={[{ id: 1, name: 'Home', icon: 'H' }, { id: 2, name: 'Work', icon: 'W' }] as never}
                isDark={true}
                language="en"
                onBulkAction={onBulkAction}
                onClearSelection={vi.fn()}
                t={t}
            />
        </FeatureFlagsContext.Provider>,
    );
    return onBulkAction;
}

describe('BulkActionBar pickers and Escape', () => {
    it('closes the tag suggestions on the first Escape and the Add tags popover on the second', async () => {
        const user = userEvent.setup();
        const onBulkAction = renderBar();
        const addTags = screen.getByRole('button', { name: 'Add tags' });

        await user.click(addTags);
        expect(addTags).toHaveAttribute('aria-expanded', 'true');
        const field = screen.getByRole('combobox', { name: 'Select tags...' });
        await user.type(field, 'running{Enter}');
        // The pick closes the suggestions: nothing covers Apply and Cancel
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();

        await user.type(field, 'rea');
        expect(screen.getByRole('listbox', { name: 'Tag suggestions' })).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
        expect(field).toHaveFocus();

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
        expect(addTags).toHaveAttribute('aria-expanded', 'false');
        expect(addTags).toHaveFocus();

        // Escape was a cancel: the popover opens again empty
        await user.click(addTags);
        expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
        expect(onBulkAction).not.toHaveBeenCalled();
    });

    it.each([
        ['Rephrase', 'Grammar/form only'],
        ['Move to diary', 'H Home'],
    ])('closes the %s picker on Escape and gives focus back to its button', async (trigger, choice) => {
        const user = userEvent.setup();
        renderBar();
        const button = screen.getByRole('button', { name: trigger });

        await user.click(button);
        expect(button).toHaveAttribute('aria-expanded', 'true');
        screen.getByRole('button', { name: choice }).focus();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('button', { name: choice })).not.toBeInTheDocument();
        expect(button).toHaveFocus();
    });

    it('leaves Escape alone while no picker is open', async () => {
        const user = userEvent.setup();
        renderBar();
        const addTags = screen.getByRole('button', { name: 'Add tags' });
        addTags.focus();

        await user.keyboard('{Escape}');
        expect(addTags).toHaveFocus();
        expect(addTags).toHaveAttribute('aria-expanded', 'false');
    });
});
