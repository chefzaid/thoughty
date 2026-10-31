/** Text shown in place of a Markdown entry while its renderer loads; the rendered one is marked. */
const LOADING_TEXT = '.markdown-content:not([data-markdown])';

/**
 * Calls `onReady` once the sheet is complete: no Markdown text still loading and every picture in it
 * loaded (or failed to). Watches the sheet as it fills in; the returned function stops watching.
 */
export function whenSheetReady(sheet: HTMLElement, onReady: () => void): () => void {
    let done = false;
    const observer = new MutationObserver(() => check());

    function check(): void {
        if (done || sheet.querySelector(LOADING_TEXT)) return;
        const pending = [...sheet.querySelectorAll('img')].filter((image) => !image.complete);
        if (pending.length > 0) {
            // The same listener is added once per picture however often this runs
            for (const image of pending) {
                image.addEventListener('load', check, { once: true });
                image.addEventListener('error', check, { once: true });
            }
            return;
        }
        done = true;
        observer.disconnect();
        onReady();
    }

    observer.observe(sheet, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'data-markdown'] });
    check();
    return () => {
        done = true;
        observer.disconnect();
    };
}
