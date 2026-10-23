/** The styles that decide where text wraps and how tall its lines are. */
const MIRRORED_STYLES = [
    'fontFamily',
    'fontSize',
    'fontStyle',
    'fontWeight',
    'letterSpacing',
    'lineHeight',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'tabSize',
    'textIndent',
    'textTransform',
    'wordSpacing',
] as const;

/**
 * How far below the top of the textarea's content the caret's line sits, measured on a hidden copy
 * of the text up to the caret that wraps the same way.
 */
export function caretLineTop(textarea: HTMLTextAreaElement): number {
    const style = getComputedStyle(textarea);
    const mirror = document.createElement('div');
    for (const property of MIRRORED_STYLES) {
        mirror.style[property] = style[property];
    }
    Object.assign(mirror.style, {
        position: 'absolute',
        top: '0',
        left: '-9999px',
        visibility: 'hidden',
        boxSizing: 'border-box',
        width: `${textarea.clientWidth}px`,
        border: '0',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
    });
    mirror.textContent = textarea.value.slice(0, textarea.selectionEnd ?? textarea.value.length);
    const marker = document.createElement('span');
    marker.textContent = '​';
    mirror.appendChild(marker);

    document.body.appendChild(mirror);
    const top = marker.offsetTop + marker.offsetHeight / 2;
    mirror.remove();
    return top;
}

/** The scroll position that puts a line at the vertical middle of a view of the given height. */
export function typewriterScrollTop(lineTop: number, viewHeight: number): number {
    return Math.max(0, Math.round(lineTop - viewHeight / 2));
}

export function prefersReducedMotion(): boolean {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Scrolls the textarea so the caret's line stays near its vertical middle. */
export function centerCaretLine(textarea: HTMLTextAreaElement, smooth: boolean): void {
    const top = typewriterScrollTop(caretLineTop(textarea), textarea.clientHeight);
    if (Math.abs(textarea.scrollTop - top) < 1) {
        return;
    }
    if (typeof textarea.scrollTo === 'function') {
        textarea.scrollTo({ top, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
    } else {
        textarea.scrollTop = top;
    }
}
