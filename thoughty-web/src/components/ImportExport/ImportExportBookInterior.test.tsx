import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BookInteriorControls } from './ImportExportBookInterior';
import { DEFAULT_BOOK_OPTIONS } from './ImportExport.types';

function renderControls(interiorTheme = DEFAULT_BOOK_OPTIONS.interiorTheme) {
    const onOptionChange = vi.fn();
    render(<BookInteriorControls options={{ ...DEFAULT_BOOK_OPTIONS, interiorTheme }} onOptionChange={onOptionChange} t={(key) => `t:${key}`} />);
    return { onOptionChange };
}

describe('BookInteriorControls', () => {
    it('offers the three interior themes, the standard one chosen by default', () => {
        renderControls();

        const group = screen.getByRole('radiogroup', { name: 't:bookInteriorTheme' });
        expect(group).toBeInTheDocument();
        expect(screen.getAllByRole('radio').map((radio) => (radio as HTMLInputElement).value)).toEqual(['standard', 'elegant', 'large-print']);
        expect(screen.getByRole('radio', { name: 't:bookInteriorStandard' })).toBeChecked();
        expect(screen.getByRole('group', { name: 't:bookInterior' })).toHaveAccessibleDescription('t:bookInteriorHint');
    });

    it('describes each theme to screen readers and marks the chosen one', () => {
        renderControls('elegant');

        const elegant = screen.getByRole('radio', { name: 't:bookInteriorElegant' });
        expect(elegant).toBeChecked();
        expect(elegant).toHaveAccessibleDescription('t:bookInteriorElegantDescription');
        expect(elegant.closest('label')).toHaveClass('is-selected');
        expect(screen.getByRole('radio', { name: 't:bookInteriorLargePrint' })).toHaveAccessibleDescription('t:bookInteriorLargePrintDescription');
    });

    it('chooses a theme', () => {
        const { onOptionChange } = renderControls();

        fireEvent.click(screen.getByRole('radio', { name: 't:bookInteriorLargePrint' }));

        expect(onOptionChange).toHaveBeenCalledWith('interiorTheme', 'large-print');
    });
});
