import type { TranslationFunction } from '../../types';
import { BOOK_PDF_SECTIONS, type BookPdfChapter, type BookPdfSection, type BookPdfSections } from './bookPdf';

/** The page a jump-list choice opens: the title page, one of the book's own pages, or a chapter. */
export interface JumpTarget {
    readonly label: string;
    readonly pageNumber: number;
}

const SECTION_LABEL_KEYS: Record<BookPdfSection, string> = {
    dedication: 'bookPagePreviewDedication',
    epigraph: 'bookPagePreviewEpigraph',
    contents: 'bookPagePreviewContents',
    about: 'bookPagePreviewAbout',
};

/**
 * The book's own contents for the jump list, in page order: the title page, the pages the PDF names
 * (dedication, epigraph, table of contents, when the book has them), the chapters, then the closing page.
 */
export function bookJumpTargets(
    chapters: readonly BookPdfChapter[],
    sections: BookPdfSections,
    t: TranslationFunction,
): JumpTarget[] {
    const named = BOOK_PDF_SECTIONS.flatMap((section) => {
        const pageNumber = sections[section];
        return pageNumber ? [{ label: t(SECTION_LABEL_KEYS[section]), pageNumber }] : [];
    });
    return [
        { label: t('bookPagePreviewTitlePage'), pageNumber: 1 },
        ...named,
        ...chapters.map((chapter) => ({
            label: t('bookPagePreviewChapterOption', { title: chapter.title, page: chapter.pageNumber }),
            pageNumber: chapter.pageNumber,
        })),
    ].sort((left, right) => left.pageNumber - right.pageNumber);
}

/** The jump-list entry the page belongs to: the last one starting on or before it. */
export function currentJumpTarget(targets: readonly JumpTarget[], pageNumber: number): JumpTarget | undefined {
    return targets.filter((target) => target.pageNumber <= pageNumber).at(-1);
}
