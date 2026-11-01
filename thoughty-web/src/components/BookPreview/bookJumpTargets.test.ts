import { describe, expect, it } from 'vitest';
import { bookJumpTargets, currentJumpTarget } from './bookJumpTargets';

const t = (key: string, params?: Record<string, string | number>) => (params ? `${key}:${params.title}@${params.page}` : key);

describe('bookJumpTargets', () => {
    it('lists the title page, the contents when printed, and every chapter', () => {
        expect(bookJumpTargets([{ title: 'Chapter 1: ideas', pageNumber: 3 }], { contents: 2 }, t)).toEqual([
            { label: 'bookPagePreviewTitlePage', pageNumber: 1 },
            { label: 'bookPagePreviewContents', pageNumber: 2 },
            { label: 'bookPagePreviewChapterOption:Chapter 1: ideas@3', pageNumber: 3 },
        ]);
    });

    it('leaves out the contents the PDF does not name', () => {
        expect(bookJumpTargets([{ title: 'Chapter 1: ideas', pageNumber: 2 }], {}, t).map((target) => target.pageNumber)).toEqual([1, 2]);
    });

    it('lists the dedication and epigraph pages before the contents, in page order', () => {
        const targets = bookJumpTargets([{ title: 'Chapter 1: ideas', pageNumber: 5 }], { contents: 4, epigraph: 3, dedication: 2 }, t);

        expect(targets.map((target) => target.label)).toEqual([
            'bookPagePreviewTitlePage',
            'bookPagePreviewDedication',
            'bookPagePreviewEpigraph',
            'bookPagePreviewContents',
            'bookPagePreviewChapterOption:Chapter 1: ideas@5',
        ]);
        expect(currentJumpTarget(targets, 3)?.label).toBe('bookPagePreviewEpigraph');
    });

    it('lists the closing page last', () => {
        const targets = bookJumpTargets([{ title: 'Chapter 1: ideas', pageNumber: 2 }], { about: 4 }, t);

        expect(targets.map((target) => target.label)).toEqual([
            'bookPagePreviewTitlePage',
            'bookPagePreviewChapterOption:Chapter 1: ideas@2',
            'bookPagePreviewAbout',
        ]);
        expect(currentJumpTarget(targets, 3)?.label).toBe('bookPagePreviewChapterOption:Chapter 1: ideas@2');
    });

    it('offers only the title page for a book without chapters', () => {
        expect(bookJumpTargets([], {}, t)).toEqual([{ label: 'bookPagePreviewTitlePage', pageNumber: 1 }]);
    });
});
