import type { TranslationFunction } from '../../types';
import type { BookPdfChapter } from './bookPdf';

/** The page a jump-list choice opens: the title page, the table of contents, or a chapter. */
export interface JumpTarget {
    readonly label: string;
    readonly pageNumber: number;
}

/** The book's own contents for the jump list: title page, table of contents (when printed), chapters. */
export function bookJumpTargets(chapters: readonly BookPdfChapter[], t: TranslationFunction): JumpTarget[] {
    const firstChapterPage = chapters[0]?.pageNumber ?? Number.POSITIVE_INFINITY;
    return [
        { label: t('bookPagePreviewTitlePage'), pageNumber: 1 },
        ...(firstChapterPage > 2 && chapters.length > 0
            ? [{ label: t('bookPagePreviewContents'), pageNumber: 2 }]
            : []),
        ...chapters.map((chapter) => ({
            label: t('bookPagePreviewChapterOption', { title: chapter.title, page: chapter.pageNumber }),
            pageNumber: chapter.pageNumber,
        })),
    ];
}

/** The jump-list entry the page belongs to: the last one starting on or before it. */
export function currentJumpTarget(targets: readonly JumpTarget[], pageNumber: number): JumpTarget | undefined {
    return targets.filter((target) => target.pageNumber <= pageNumber).at(-1);
}
