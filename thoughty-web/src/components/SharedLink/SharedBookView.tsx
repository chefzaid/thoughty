import { useState } from 'react';
import { fetchSharedBookFile, type SharedBookVersion } from '../../services/api/shareLinksService';
import type { TranslationFunction } from '../../types';
import { downloadBlob } from '../../utils/downloadFile';
import { formatFileSize } from '../../utils/fileSize';
import { tintedTextClass } from '../../utils/tintedText';

interface SharedBookViewProps {
    readonly token: string;
    readonly book: SharedBookVersion;
    readonly theme: 'light' | 'dark';
    readonly fetchImpl?: typeof fetch;
    /** The link stopped working meanwhile (its last view was used, or it was revoked). */
    readonly onUnavailable: () => void;
    readonly t: TranslationFunction;
}

/** A shared book version: its title and author, and its stored file to download, which counts a view. */
export default function SharedBookView({ token, book, theme, fetchImpl, onUnavailable, t }: SharedBookViewProps) {
    const [downloading, setDownloading] = useState(false);
    const [failed, setFailed] = useState(false);

    const handleDownload = async () => {
        setDownloading(true);
        setFailed(false);
        const result = await fetchSharedBookFile(token, fetchImpl);
        setDownloading(false);
        if (result.status === 'ready') {
            downloadBlob(result.file, book.filename);
        } else if (result.status === 'unavailable') {
            onUnavailable();
        } else {
            setFailed(true);
        }
    };

    return (
        <article className="space-y-4">
            <h1 className="text-2xl font-semibold">{book.title}</h1>
            {book.author && <p className={theme === 'light' ? 'text-gray-700' : 'text-gray-200'}>{t('sharedBookBy', { author: book.author })}</p>}
            <p className={`text-sm ${theme === 'light' ? 'text-gray-600' : 'text-gray-300'}`}>
                {book.format.toUpperCase()} · {formatFileSize(book.size)}
            </p>
            <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-800 disabled:opacity-60"
            >
                <span className={`codicon ${downloading ? 'codicon-loading codicon-modifier-spin' : 'codicon-cloud-download'}`} aria-hidden="true" />
                {t('sharedBookDownload')}
            </button>
            {failed && <p role="alert" className={`text-sm ${tintedTextClass('red', theme)}`}>{t('sharedFailedText')}</p>}
        </article>
    );
}
