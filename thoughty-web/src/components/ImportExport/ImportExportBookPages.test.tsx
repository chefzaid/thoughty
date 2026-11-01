import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { getTranslation, type Language } from '../../utils/translations';
import { DEFAULT_BOOK_OPTIONS, type BookOptions } from './ImportExport.types';
import { BookPagesControls } from './ImportExportBookPages';

function renderPages(language: Language, options: BookOptions = DEFAULT_BOOK_OPTIONS) {
    const onOptionChange = vi.fn();
    render(<BookPagesControls options={options} onOptionChange={onOptionChange} t={(key, params) => getTranslation(language, key, params)} />);
    return onOptionChange;
}

describe('BookPagesControls', () => {
    it('edits the dedication and epigraph, within the API’s limits', () => {
        const onOptionChange = renderPages('en', { ...DEFAULT_BOOK_OPTIONS, dedication: 'For Marie' });
        const dedication = screen.getByLabelText('Dedication');
        const epigraph = screen.getByLabelText('Epigraph');

        expect(dedication).toHaveValue('For Marie');
        expect(dedication).toHaveAttribute('maxLength', '300');
        expect(epigraph).toHaveAttribute('maxLength', '500');
        fireEvent.change(epigraph, { target: { value: 'A quotation\n— Someone' } });
        expect(onOptionChange).toHaveBeenCalledWith('epigraph', 'A quotation\n— Someone');
        expect(screen.getByRole('group', { name: 'Book pages' })).toHaveAccessibleDescription(/up to 300 characters, an epigraph up to 500/);
    });

    it('turns the closing page on and off', () => {
        const onOptionChange = renderPages('en');
        const closing = screen.getByRole('checkbox', { name: /About this book/ });

        expect(closing).not.toBeChecked();
        fireEvent.click(closing);
        expect(onOptionChange).toHaveBeenCalledWith('closingPage', true);
    });

    it('speaks French', () => {
        renderPages('fr');

        expect(screen.getByRole('checkbox', { name: /À propos de ce livre/ })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Pages du livre' })).toBeInTheDocument();
        expect(screen.getByLabelText('Dédicace')).toBeInTheDocument();
        expect(screen.getByLabelText('Épigraphe')).toBeInTheDocument();
    });
});
