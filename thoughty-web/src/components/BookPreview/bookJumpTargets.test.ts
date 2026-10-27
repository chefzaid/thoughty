import { describe, expect, it } from 'vitest';
import { bookJumpTargets } from './bookJumpTargets';

const t = (key: string, params?: Record<string, string | number>) => (params ? `${key}:${params.title}@${params.page}` : key);

describe('bookJumpTargets', () => {
    it('lists the title page, the contents when printed, and every chapter', () => {
        expect(bookJumpTargets([{ title: 'Chapter 1: ideas', pageNumber: 3 }], t)).toEqual([
            { label: 'bookPagePreviewTitlePage', pageNumber: 1 },
            { label: 'bookPagePreviewContents', pageNumber: 2 },
            { label: 'bookPagePreviewChapterOption:Chapter 1: ideas@3', pageNumber: 3 },
        ]);
    });

    it('leaves out the contents when the first chapter follows the title page', () => {
        expect(bookJumpTargets([{ title: 'Chapter 1: ideas', pageNumber: 2 }], t).map((target) => target.pageNumber)).toEqual([1, 2]);
    });

    it('offers only the title page for a book without chapters', () => {
        expect(bookJumpTargets([], t)).toEqual([{ label: 'bookPagePreviewTitlePage', pageNumber: 1 }]);
    });
});
