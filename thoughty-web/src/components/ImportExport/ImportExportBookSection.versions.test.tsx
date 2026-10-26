import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getTranslation } from '../../utils/translations';
import { DEFAULT_BOOK_OPTIONS, type BookVersionData } from './ImportExport.types';
import { BookSection } from './ImportExportBookSection';

const version = (chapterCount: number, entryCount: number, addedEntryCount: number, addedChapterTitles: string[]): BookVersionData => ({
    id: 1,
    versionNumber: 1,
    title: 'My Book',
    format: 'pdf',
    filename: 'my-book.pdf',
    chapterCount,
    entryCount,
    addedEntryCount,
    addedChapterTitles,
    createdAt: '2026-10-26T10:00:00.000Z',
});

describe('BookSection versions', () => {
    it.each([
        ['en', version(1, 1, 1, ['Travel']), '1 chapter · 1 entry', '1 new entry · 1 new chapter: Travel'],
        ['en', version(2, 3, 0, []), '2 chapters · 3 entries', '0 new entries · 0 new chapters'],
        ['fr', version(1, 1, 1, ['Voyage']), '1 chapitre · 1 entrée', '1 nouvelle entrée · 1 nouveau chapitre: Voyage'],
        ['fr', version(2, 3, 0, []), '2 chapitres · 3 entrées', '0 nouvelle entrée · 0 nouveau chapitre'],
    ] as const)('counts chapters and entries in %s', (language, bookVersion, counts, changes) => {
        render(
            <BookSection
                activeSection="book"
                sectionRef={{ current: null }}
                options={DEFAULT_BOOK_OPTIONS}
                preview={null}
                generating={false}
                uploading={false}
                savingVersion={false}
                versions={[bookVersion]}
                downloadingVersionId={null}
                connectedProviders={[]}
                cloudProvider=""
                onOptionChange={vi.fn()}
                onCloudProviderChange={vi.fn()}
                onPreview={vi.fn()}
                onDownload={vi.fn()}
                onUpload={vi.fn()}
                onCreateVersion={vi.fn()}
                onVersionDownload={vi.fn()}
                language={language}
                t={(key, params) => getTranslation(language, key, params)}
            />,
        );

        expect(screen.getByText(counts, { exact: false })).toBeInTheDocument();
        expect(screen.getByText(changes)).toBeInTheDocument();
    });
});
