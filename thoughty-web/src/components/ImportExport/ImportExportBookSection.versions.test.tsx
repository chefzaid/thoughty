import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { getTranslation, type Language } from '../../utils/translations';
import { DEFAULT_BOOK_OPTIONS, type BookVersionData } from './ImportExport.types';
import { BookSection } from './ImportExportBookSection';

const version = (
    chapterCount: number,
    entryCount: number,
    addedEntryCount: number,
    addedChapterTitles: string[],
    source: BookVersionData['source'] = { kind: 'journal', diaryId: 1 },
): BookVersionData => ({
    id: 1,
    versionNumber: 1,
    title: 'My Book',
    format: 'pdf',
    filename: 'my-book.pdf',
    chapterCount,
    entryCount,
    addedEntryCount,
    addedChapterTitles,
    source,
    createdAt: '2026-10-26T10:00:00.000Z',
});

function renderSection(language: Language, versions: BookVersionData[], props: Partial<ComponentProps<typeof BookSection>> = {}) {
    return render(
        <BookSection
            activeSection="book"
            sectionRef={{ current: null }}
            options={DEFAULT_BOOK_OPTIONS}
            preview={null}
            sourceReady
            savedSearches={{ status: 'idle' }}
            pickedEntries={{ status: 'idle' }}
            generating={false}
            uploading={false}
            savingVersion={false}
            versions={versions}
            downloadingVersionId={null}
            connectedProviders={[]}
            cloudProvider=""
            onOptionChange={vi.fn()}
            onCloudProviderChange={vi.fn()}
            onPreview={vi.fn()}
            onPagePreview={vi.fn()}
            onDownload={vi.fn()}
            onUpload={vi.fn()}
            onCreateVersion={vi.fn()}
            onVersionDownload={vi.fn()}
            onUseVersionEntries={vi.fn()}
            onVersionShare={vi.fn()}
            language={language}
            t={(key, params) => getTranslation(language, key, params)}
            {...props}
        />,
    );
}

describe('BookSection versions', () => {
    it.each([
        ['en', version(1, 1, 1, ['Travel']), '1 chapter · 1 entry', '1 new entry · 1 new chapter: Travel'],
        ['en', version(2, 3, 0, []), '2 chapters · 3 entries', '0 new entries · 0 new chapters'],
        ['fr', version(1, 1, 1, ['Voyage']), '1 chapitre · 1 entrée', '1 nouvelle entrée · 1 nouveau chapitre: Voyage'],
        ['fr', version(2, 3, 0, []), '2 chapitres · 3 entrées', '0 nouvelle entrée · 0 nouveau chapitre'],
    ] as const)('counts chapters and entries in %s', (language, bookVersion, counts, changes) => {
        renderSection(language, [bookVersion]);

        expect(screen.getByText(counts, { exact: false })).toBeInTheDocument();
        expect(screen.getByText(changes)).toBeInTheDocument();
    });

    it.each([
        ['en', { kind: 'journal', diaryId: 1 }, 'From the journal'],
        ['en', { kind: 'savedSearch', savedSearchId: 4, savedSearchName: 'Family' }, 'From the saved search Family'],
        ['en', { kind: 'entries', entryIds: [3] }, '1 hand-picked entry'],
        ['fr', { kind: 'entries', entryIds: [3, 4] }, '2 entrées choisies'],
        ['fr', { kind: 'savedSearch', savedSearchId: 4, savedSearchName: 'Famille' }, 'Depuis la recherche enregistrée Famille'],
    ] satisfies Array<[Language, BookVersionData['source'], string]>)('says where a version’s entries came from in %s', (language, source, label) => {
        renderSection(language, [version(1, 1, 1, [], source)]);

        expect(screen.getByText(label)).toBeInTheDocument();
    });

    it('builds the next hand-picked version from a saved version’s entries', () => {
        const onUseVersionEntries = vi.fn();
        const picked = version(1, 2, 2, [], { kind: 'entries', entryIds: [3, 4] });
        renderSection('en', [picked, { ...version(1, 1, 1, []), id: 2, versionNumber: 2 }], { onUseVersionEntries });

        expect(screen.getAllByRole('button', { name: /Use the entries of version/ })).toHaveLength(1);
        fireEvent.click(screen.getByRole('button', { name: 'Use the entries of version 1' }));

        expect(onUseVersionEntries).toHaveBeenCalledWith(picked);
    });

    it('opens the private share links of a version', () => {
        const onVersionShare = vi.fn();
        const shared = { ...version(1, 1, 1, []), id: 2, versionNumber: 2 };
        renderSection('fr', [shared], { onVersionShare });

        fireEvent.click(screen.getByRole('button', { name: 'Partager la version 2 en privé' }));

        expect(onVersionShare).toHaveBeenCalledWith(shared);
    });

    it('keeps the book actions off until the source names its entries', () => {
        renderSection('fr', [], { sourceReady: false, options: { ...DEFAULT_BOOK_OPTIONS, source: 'entries' } });

        for (const name of ['Aperçu des chapitres', 'Aperçu du livre', 'Télécharger le livre', 'Enregistrer la première version']) {
            expect(screen.getByRole('button', { name: new RegExp(name) })).toBeDisabled();
        }
        expect(screen.getByText(/Dans le journal, sélectionnez des entrées puis choisissez Faire un livre/)).toBeInTheDocument();
        expect(screen.getByLabelText('Titre')).toHaveAttribute('placeholder', 'Donnez un titre à votre livre');
    });
});
