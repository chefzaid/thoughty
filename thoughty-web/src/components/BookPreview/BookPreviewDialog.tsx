import { useId, useRef, type KeyboardEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { TranslationFunction } from '../../types';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { BookPreviewToolbar } from './BookPreviewToolbar';
import { useBookPdfReader } from './useBookPdfReader';
import './BookPreview.css';

/** Keys a form control uses itself, so they never turn pages while it has focus. */
const CONTROL_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

/**
 * The generated book, page by page, before it is downloaded: the PDF exactly as it will be saved
 * (same pages and page numbers), drawn one page at a time with previous/next, a jump list built
 * from the book's own contents, zoom, and keyboard control. The modal keeps focus inside, Escape
 * or Close leaves it, and focus goes back to the button that opened it.
 */
export function BookPreviewDialog({
    open,
    file,
    notice,
    isLight,
    onClose,
    onDownload,
    returnFocusRef,
    t,
}: Readonly<{
    open: boolean;
    /** The generated PDF, or null while it is being generated. */
    file: Blob | null;
    /** Shown above the pages, e.g. that another format downloads separately. */
    notice?: string;
    isLight: boolean;
    onClose: () => void;
    onDownload: () => void;
    returnFocusRef?: RefObject<HTMLElement | null>;
    t: TranslationFunction;
}>) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const hintId = useId();
    const reader = useBookPdfReader(open ? file : null);

    useDialogFocus({ isOpen: open, dialogRef, initialFocusRef: closeButtonRef, onClose, returnFocusRef });

    if (!open) return null;

    const ready = reader.status === 'ready';
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement;
        if (!ready || CONTROL_TAGS.has(target.tagName) || event.altKey || event.ctrlKey || event.metaKey) return;
        const actions: Record<string, () => void> = {
            ArrowLeft: () => reader.goToPage(reader.pageNumber - 1),
            PageUp: () => reader.goToPage(reader.pageNumber - 1),
            ArrowRight: () => reader.goToPage(reader.pageNumber + 1),
            PageDown: () => reader.goToPage(reader.pageNumber + 1),
            Home: () => reader.goToPage(1),
            End: () => reader.goToPage(reader.pageCount),
            '+': () => reader.changeZoom(1),
            '=': () => reader.changeZoom(1),
            '-': () => reader.changeZoom(-1),
            '0': () => reader.changeZoom(0),
        };
        const action = actions[event.key];
        if (!action) return;
        event.preventDefault();
        action();
    };

    let progress: string | null = null;
    if (!file) progress = t('bookPagePreviewGenerating');
    else if (reader.status === 'opening' || reader.status === 'idle') progress = t('bookPagePreviewOpening');

    return createPortal(
        <div className={`book-reader-backdrop ${isLight ? 'book-reader--light' : 'book-reader--dark'}`}>
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-busy={progress !== null}
                className="book-reader"
                onKeyDown={handleKeyDown}
            >
                <div className="book-reader__header">
                    <h2 id={titleId} className="book-reader__title">{t('bookPagePreviewTitle')}</h2>
                    <div className="book-reader__actions">
                        <button type="button" className="book-reader__btn book-reader__btn--primary" onClick={onDownload} disabled={!file}>
                            <span className="codicon codicon-cloud-download" aria-hidden="true" />
                            {t('bookPagePreviewDownload')}
                        </button>
                        <button ref={closeButtonRef} type="button" className="book-reader__btn book-reader__btn--text" onClick={onClose}>
                            {t('close')}
                        </button>
                    </div>
                </div>

                {notice && <p className="book-reader__notice">{notice}</p>}

                {ready && (
                    <BookPreviewToolbar
                        chapters={reader.chapters}
                        pageNumber={reader.pageNumber}
                        pageCount={reader.pageCount}
                        zoom={reader.zoom}
                        canZoomIn={reader.canZoomIn}
                        canZoomOut={reader.canZoomOut}
                        onGoToPage={reader.goToPage}
                        onZoom={reader.changeZoom}
                        t={t}
                    />
                )}

                {progress && (
                    <div className="book-reader__progress" role="status">
                        <span className="codicon codicon-loading codicon-modifier-spin" aria-hidden="true" />
                        {progress}
                    </div>
                )}
                {reader.status === 'failed' && (
                    <p className="book-reader__error" role="alert">{t('bookPagePreviewOpenError')}</p>
                )}

                {ready && (
                    <>
                        <p id={hintId} className="sr-only">{t('bookPagePreviewKeyboardHint')}</p>
                        <div
                            ref={reader.viewportRef}
                            className="book-reader__viewport"
                            role="region"
                            aria-label={t('bookPagePreviewPage', { page: reader.pageNumber, count: reader.pageCount })}
                            aria-describedby={hintId}
                            tabIndex={0}
                        >
                            <canvas ref={reader.canvasRef} className="book-reader__page" aria-hidden="true" />
                            <div className="sr-only" data-testid="book-preview-page-text">{reader.pageText}</div>
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body,
    );
}
