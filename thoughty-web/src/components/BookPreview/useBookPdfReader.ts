import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { isCancelledRender, openBookPdf, type BookPdf } from './bookPdf';

/** Zoom steps, as multiples of "fit page" (the whole page visible). */
export const BOOK_ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;
const FIT_ZOOM_INDEX = BOOK_ZOOM_STEPS.indexOf(1);

export type BookPdfReaderStatus = 'idle' | 'opening' | 'ready' | 'failed';

interface ElementSize {
    width: number;
    height: number;
}

/** The element's content size, kept current while it resizes (a phone rotating, the window changing). */
function useElementSize(ref: RefObject<HTMLElement | null>, enabled: boolean): ElementSize {
    const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

    useEffect(() => {
        const element = ref.current;
        if (!enabled || !element) return undefined;
        const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
        measure();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, [enabled, ref]);

    return size;
}

/** Breathing room around the page inside the reader's viewport, in CSS pixels. */
const PAGE_GUTTER = 24;

/** The scale that shows the whole page in the viewport, or 100% before the viewport is measured. */
function fitScale(page: ElementSize, viewport: ElementSize): number {
    if (viewport.width <= 0 || viewport.height <= 0) return 1;
    const width = Math.max(viewport.width - PAGE_GUTTER, 1);
    const height = Math.max(viewport.height - PAGE_GUTTER, 1);
    return Math.min(width / page.width, height / page.height);
}

/**
 * Reads a generated book PDF page by page: opens it, draws the current page on the canvas at the
 * current zoom, and extracts the page's text for screen readers. Closing (or another file) cancels
 * the drawing in progress and releases the document.
 */
export function useBookPdfReader(file: Blob | null) {
    const [pdf, setPdf] = useState<BookPdf | null>(null);
    const [status, setStatus] = useState<BookPdfReaderStatus>('idle');
    const [pageNumber, setPageNumber] = useState(1);
    const [zoomIndex, setZoomIndex] = useState(FIT_ZOOM_INDEX);
    const [pageText, setPageText] = useState('');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const viewportSize = useElementSize(viewportRef, status === 'ready');
    const zoom = BOOK_ZOOM_STEPS[zoomIndex] ?? 1;

    useEffect(() => {
        setPdf(null);
        setPageNumber(1);
        setZoomIndex(FIT_ZOOM_INDEX);
        if (!file) {
            setStatus('idle');
            return undefined;
        }

        let active = true;
        let opened: BookPdf | null = null;
        setStatus('opening');
        file.arrayBuffer()
            .then(openBookPdf)
            .then((document) => {
                opened = document;
                if (!active) {
                    void document.destroy();
                    return;
                }
                setPdf(document);
                setStatus(document.pageCount > 0 ? 'ready' : 'failed');
            })
            .catch((error: unknown) => {
                console.error('Book preview could not open the PDF:', error);
                if (active) setStatus('failed');
            });

        return () => {
            active = false;
            void opened?.destroy();
        };
    }, [file]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!pdf || !canvas) return undefined;

        let active = true;
        let cancelRender: (() => void) | null = null;
        pdf.pageSize(pageNumber)
            .then((size) => {
                if (!active) return undefined;
                const render = pdf.renderPage(pageNumber, canvas, fitScale(size, viewportSize) * zoom);
                cancelRender = () => render.cancel();
                return render.done;
            })
            .catch((error: unknown) => {
                if (!isCancelledRender(error)) console.error('Book preview could not draw the page:', error);
            });

        return () => {
            active = false;
            cancelRender?.();
        };
    }, [pdf, pageNumber, viewportSize, zoom]);

    useEffect(() => {
        if (!pdf) return undefined;
        let active = true;
        setPageText('');
        pdf.pageText(pageNumber)
            .then((text) => {
                if (active) setPageText(text);
            })
            .catch((error: unknown) => console.error('Book preview could not read the page text:', error));
        return () => {
            active = false;
        };
    }, [pdf, pageNumber]);

    const pageCount = pdf?.pageCount ?? 0;
    const goToPage = useCallback((target: number) => {
        setPageNumber(Math.min(Math.max(Math.round(target), 1), Math.max(pageCount, 1)));
    }, [pageCount]);
    const changeZoom = useCallback((step: -1 | 0 | 1) => {
        setZoomIndex((current) => (step === 0
            ? FIT_ZOOM_INDEX
            : Math.min(Math.max(current + step, 0), BOOK_ZOOM_STEPS.length - 1)));
    }, []);

    return {
        canvasRef,
        changeZoom,
        chapters: pdf?.chapters ?? [],
        goToPage,
        pageCount,
        pageNumber,
        pageText,
        status,
        viewportRef,
        zoom,
        canZoomIn: zoomIndex < BOOK_ZOOM_STEPS.length - 1,
        canZoomOut: zoomIndex > 0,
    };
}
