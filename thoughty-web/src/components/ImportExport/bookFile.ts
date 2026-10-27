import type { BookOptions } from './ImportExport.types';

/** A generated book file, kept in memory to show it or save it. */
export interface GeneratedBookFile {
    readonly blob: Blob;
    readonly filename: string;
}

/** The last PDF generated, and the settings (and cover image) it was generated with. */
export interface CachedBookPdf {
    readonly settings: string;
    readonly coverImage: File | null;
    readonly file: GeneratedBookFile;
}

/** The book file in an export answer, named as the server's Content-Disposition names it. */
export async function readBookFile(response: Response, extension: string): Promise<GeneratedBookFile> {
    const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replaceAll('"', '')
        || `thoughty_book_${new Date().toISOString().split('T')[0]}.${extension}`;
    return { blob: await response.blob(), filename };
}

/** The request parameters that shape the PDF: every setting but the download format. */
export function pdfSettings(params: URLSearchParams): string {
    const settings = new URLSearchParams(params);
    settings.delete('format');
    return settings.toString();
}

/** Whether the cached PDF is the one these settings would generate again. */
export function isCachedPdfFor(cached: CachedBookPdf | null, settings: string, options: BookOptions): cached is CachedBookPdf {
    return cached !== null && cached.settings === settings && cached.coverImage === options.coverImage;
}

/** Whether generating the book calls the writer's AI provider (and spends their tokens). */
export function bookUsesAi(options: BookOptions): boolean {
    return options.narrative || options.chapterFraming;
}
