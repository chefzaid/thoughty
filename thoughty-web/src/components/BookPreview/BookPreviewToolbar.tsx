import type { TranslationFunction } from '../../types';
import type { BookPdfChapter } from './bookPdf';
import { bookJumpTargets, currentJumpTarget } from './bookJumpTargets';

export function BookPreviewToolbar({
    chapters,
    pageNumber,
    pageCount,
    zoom,
    canZoomIn,
    canZoomOut,
    onGoToPage,
    onZoom,
    t,
}: Readonly<{
    chapters: readonly BookPdfChapter[];
    pageNumber: number;
    pageCount: number;
    zoom: number;
    canZoomIn: boolean;
    canZoomOut: boolean;
    onGoToPage: (pageNumber: number) => void;
    onZoom: (step: -1 | 0 | 1) => void;
    t: TranslationFunction;
}>) {
    const targets = bookJumpTargets(chapters, t);
    const selected = currentJumpTarget(targets, pageNumber);

    return (
        <div className="book-reader__toolbar" role="toolbar" aria-label={t('bookPagePreviewControls')}>
            <div className="book-reader__group">
                <button
                    type="button"
                    className="book-reader__btn"
                    onClick={() => onGoToPage(pageNumber - 1)}
                    disabled={pageNumber <= 1}
                    aria-label={t('bookPagePreviewPrevious')}
                    title={t('bookPagePreviewPrevious')}
                >
                    <span className="codicon codicon-chevron-left" aria-hidden="true" />
                </button>
                <p className="book-reader__status" role="status">
                    {t('bookPagePreviewPage', { page: pageNumber, count: pageCount })}
                </p>
                <button
                    type="button"
                    className="book-reader__btn"
                    onClick={() => onGoToPage(pageNumber + 1)}
                    disabled={pageNumber >= pageCount}
                    aria-label={t('bookPagePreviewNext')}
                    title={t('bookPagePreviewNext')}
                >
                    <span className="codicon codicon-chevron-right" aria-hidden="true" />
                </button>
            </div>

            <label className="book-reader__jump">
                <span>{t('bookPagePreviewJump')}</span>
                <select
                    value={selected ? targets.indexOf(selected) : 0}
                    onChange={(event) => onGoToPage(targets[Number(event.target.value)]?.pageNumber ?? 1)}
                >
                    {targets.map((target, index) => (
                        <option key={`${target.pageNumber}-${target.label}`} value={index}>{target.label}</option>
                    ))}
                </select>
            </label>

            <div className="book-reader__group">
                <button
                    type="button"
                    className="book-reader__btn"
                    onClick={() => onZoom(-1)}
                    disabled={!canZoomOut}
                    aria-label={t('bookPagePreviewZoomOut')}
                    title={t('bookPagePreviewZoomOut')}
                >
                    <span className="codicon codicon-zoom-out" aria-hidden="true" />
                </button>
                <span className="book-reader__zoom">
                    {t('bookPagePreviewZoomLevel', { percent: Math.round(zoom * 100) })}
                </span>
                <button
                    type="button"
                    className="book-reader__btn"
                    onClick={() => onZoom(1)}
                    disabled={!canZoomIn}
                    aria-label={t('bookPagePreviewZoomIn')}
                    title={t('bookPagePreviewZoomIn')}
                >
                    <span className="codicon codicon-zoom-in" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className="book-reader__btn book-reader__btn--text"
                    onClick={() => onZoom(0)}
                    disabled={zoom === 1}
                >
                    {t('bookPagePreviewFit')}
                </button>
            </div>
        </div>
    );
}
