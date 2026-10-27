import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { getTranslation, type Language } from '../../utils/translations';
import { DEFAULT_BOOK_OPTIONS } from './ImportExport.types';
import { BookSourceControls } from './ImportExportBookSource';
import type { SavedSearchFilters } from '../../services/api/savedSearchesService';

const filters: SavedSearchFilters = {
    search: '',
    searchMode: 'keyword',
    sort: 'relevance',
    tags: [],
    date: null,
    visibility: 'all',
    archiveStatus: 'active',
    favorites: false,
    mood: '',
};
const savedSearch = (id: number, name: string, overrides: Partial<SavedSearchFilters> = {}) => ({
    id, name, diaryId: null, filters: { ...filters, ...overrides }, bookVersionCount: 0, createdAt: '', updatedAt: '',
});

function renderSource(language: Language, props: Partial<ComponentProps<typeof BookSourceControls>> = {}) {
    const onOptionChange = vi.fn();
    render(
        <BookSourceControls
            options={DEFAULT_BOOK_OPTIONS}
            diaryName="Home"
            savedSearches={{ status: 'idle' }}
            pickedEntries={{ status: 'idle' }}
            onOptionChange={onOptionChange}
            language={language}
            t={(key, params) => getTranslation(language, key, params)}
            {...props}
        />,
    );
    return onOptionChange;
}

describe('BookSourceControls', () => {
    it('offers the journal, a saved search or hand-picked entries', () => {
        const onOptionChange = renderSource('en');
        const select = screen.getByLabelText('Entries from');

        expect(within(select).getAllByRole('option').map((option) => option.textContent))
            .toEqual(['This journal (Home)', 'A saved search', 'Hand-picked entries']);
        fireEvent.change(select, { target: { value: 'savedSearch' } });
        expect(onOptionChange).toHaveBeenCalledWith('source', 'savedSearch');
        expect(screen.queryByLabelText('Saved search')).not.toBeInTheDocument();
    });

    it('lists the saved searches, a meaning search shown but not available', () => {
        const onOptionChange = renderSource('fr', {
            options: { ...DEFAULT_BOOK_OPTIONS, source: 'savedSearch' },
            savedSearches: {
                status: 'ready',
                data: [savedSearch(4, 'Famille'), savedSearch(5, 'Calme', { search: 'calme', searchMode: 'semantic' })],
            },
        });

        const select = screen.getByLabelText('Recherche enregistrée');
        expect(screen.getByRole('option', { name: 'Calme (recherche par le sens, indisponible)' })).toBeDisabled();
        expect(screen.getByText(/une nouvelle version ajoute ce qu'elle a trouvé depuis/)).toBeInTheDocument();
        fireEvent.change(select, { target: { value: '4' } });
        fireEvent.change(select, { target: { value: '' } });

        expect(onOptionChange).toHaveBeenNthCalledWith(1, 'savedSearchId', 4);
        expect(onOptionChange).toHaveBeenNthCalledWith(2, 'savedSearchId', null);
    });

    it('says when there are no saved searches', () => {
        renderSource('en', { options: { ...DEFAULT_BOOK_OPTIONS, source: 'savedSearch' }, savedSearches: { status: 'ready', data: [] } });
        expect(screen.getByText(/You have no saved searches yet/)).toBeInTheDocument();
        expect(screen.getByLabelText('Saved search')).toBeDisabled();
    });

    it('reports a saved search load failure', () => {
        renderSource('en', { options: { ...DEFAULT_BOOK_OPTIONS, source: 'savedSearch' }, savedSearches: { status: 'error', error: 'savedSearchesLoadFailed' } });
        expect(screen.getByRole('alert')).toHaveTextContent(getTranslation('en', 'savedSearchesLoadFailed'));
    });

    it('explains how to pick entries when none are picked', () => {
        renderSource('en', { options: { ...DEFAULT_BOOK_OPTIONS, source: 'entries' } });
        expect(screen.getByText('No entries picked yet. In the journal, select entries and choose Make a book.')).toBeInTheDocument();
    });

    it('lists the picked entries, flags the ones that are gone, and removes or clears them', () => {
        const onOptionChange = renderSource('en', {
            options: { ...DEFAULT_BOOK_OPTIONS, source: 'entries', entryIds: [5, 3, 9] },
            pickedEntries: {
                status: 'ready',
                data: {
                    entries: [
                        { id: 3, date: '2024-05-01', title: 'Lisbon', excerpt: 'We walked down', diaryId: 1, diaryName: 'Travel', isArchived: true },
                        { id: 5, date: '2024-06-02', title: null, excerpt: 'A quiet evening', diaryId: null, diaryName: null, isArchived: false },
                    ],
                    missingIds: [9],
                },
            },
        });

        expect(screen.getByText('3 entries picked')).toBeInTheDocument();
        expect(screen.getByText('2024-05-01 · Travel · Archived')).toBeInTheDocument();
        expect(screen.getByText('We walked down')).toBeInTheDocument();
        expect(screen.getByText('Entry #9')).toBeInTheDocument();
        expect(screen.getByText('No longer available (deleted or in the recycle bin)')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Remove Entry #9 from the book' }));
        fireEvent.click(screen.getByRole('button', { name: 'Remove 2024-06-02 A quiet evening from the book' }));
        fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));

        expect(onOptionChange.mock.calls).toEqual([
            ['entryIds', [5, 3]],
            ['entryIds', [3, 9]],
            ['entryIds', []],
        ]);
    });

    it('shows the picks loading and a lookup failure in French', () => {
        renderSource('fr', { options: { ...DEFAULT_BOOK_OPTIONS, source: 'entries', entryIds: [1] }, pickedEntries: { status: 'loading' } });
        expect(screen.getByText('1 entrée choisie')).toBeInTheDocument();
        expect(screen.getByText('Chargement des entrées choisies...')).toBeInTheDocument();
    });

    it('translates the API’s reason when the picks cannot be looked up', () => {
        renderSource('fr', {
            options: { ...DEFAULT_BOOK_OPTIONS, source: 'entries', entryIds: [1] },
            pickedEntries: { status: 'error', error: 'apiError_BOOK_PICKED_ENTRIES_LIMIT' },
        });
        expect(screen.getByRole('alert')).toHaveTextContent('Trop d’entrées sont choisies pour un seul livre.');
    });
});
