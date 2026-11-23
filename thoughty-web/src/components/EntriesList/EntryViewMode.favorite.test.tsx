import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EntryViewMode from './EntryViewMode';
import { createEntryViewModeProps, mockEntries } from './EntriesList.test-utils';

const star = (theme: 'light' | 'dark', isFavorite: boolean) => {
    render(<EntryViewMode {...createEntryViewModeProps({ config: { theme }, entry: { ...mockEntries[0], is_favorite: isFavorite } })} />);
    const button = screen.getByRole('button', { name: isFavorite ? 'Unfavorite' : 'Favorite' });
    return { button, icon: button.querySelector('svg')! };
};

describe('EntryViewMode favorite star', () => {
    it('keeps the yellow fill and draws the outline in yellow-700 in the light theme', () => {
        const { button, icon } = star('light', true);

        expect(button).toHaveClass('text-yellow-700');
        expect(button).not.toHaveClass('text-yellow-500');
        expect(icon).toHaveClass('fill-yellow-500');
        expect(icon).toHaveAttribute('stroke', 'currentColor');
        expect(icon).not.toHaveAttribute('fill');
    });

    it('stays yellow-500 in the dark theme, where it already reaches 3:1', () => {
        const { button, icon } = star('dark', true);

        expect(button).toHaveClass('text-yellow-500');
        expect(icon).toHaveClass('fill-yellow-500');
    });

    it.each(['light', 'dark'] as const)('draws an entry that is not a favorite as a gray outline in the %s theme', (theme) => {
        const { button, icon } = star(theme, false);

        expect(button).toHaveClass('text-gray-500');
        expect(icon).toHaveClass('fill-none');
    });
});
