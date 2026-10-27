import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BOOK_OPTIONS } from './ImportExport.types';
import { bookUsesAi, isCachedPdfFor, pdfSettings, readBookFile } from './bookFile';

const response = (disposition: string | null) => ({
    headers: new Headers(disposition ? { 'Content-Disposition': disposition } : {}),
    blob: async () => new Blob(['book']),
}) as unknown as Response;

describe('bookFile', () => {
    it('names the file as the server does, or by date when it does not', async () => {
        expect((await readBookFile(response('attachment; filename="thoughty_book_Notes.pdf"'), 'pdf')).filename).toBe('thoughty_book_Notes.pdf');

        vi.useFakeTimers({ now: new Date('2026-10-27T09:00:00Z') });
        expect((await readBookFile(response(null), 'epub')).filename).toBe('thoughty_book_2026-10-27.epub');
        vi.useRealTimers();
    });

    it('keys the PDF on every setting but the format, and on the cover image itself', () => {
        const settings = pdfSettings(new URLSearchParams('diaryId=1&format=epub&includeToc=false'));
        const cover = new File(['png'], 'cover.png');
        const cached = { settings, coverImage: cover, file: { blob: new Blob(), filename: 'book.pdf' } };

        expect(settings).toBe('diaryId=1&includeToc=false');
        expect(isCachedPdfFor(null, settings, DEFAULT_BOOK_OPTIONS)).toBe(false);
        expect(isCachedPdfFor(cached, settings, { ...DEFAULT_BOOK_OPTIONS, coverImage: cover })).toBe(true);
        expect(isCachedPdfFor(cached, settings, { ...DEFAULT_BOOK_OPTIONS, coverImage: new File(['png'], 'cover.png') })).toBe(false);
        expect(isCachedPdfFor(cached, 'diaryId=1', { ...DEFAULT_BOOK_OPTIONS, coverImage: cover })).toBe(false);
    });

    it('knows when generating calls the AI provider', () => {
        expect(bookUsesAi(DEFAULT_BOOK_OPTIONS)).toBe(true);
        expect(bookUsesAi({ ...DEFAULT_BOOK_OPTIONS, narrative: false })).toBe(false);
        expect(bookUsesAi({ ...DEFAULT_BOOK_OPTIONS, narrative: false, chapterFraming: true })).toBe(true);
    });
});
