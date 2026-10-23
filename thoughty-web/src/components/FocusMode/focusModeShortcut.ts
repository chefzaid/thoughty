/** Ctrl+Shift+F (Cmd+Shift+F on a Mac) opens focus mode for the entry being written, and leaves it again. */
export function isFocusModeShortcut(event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'key'>): boolean {
    return (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'f';
}

/** Marks a writing area whose focus mode the shortcut opens while focus is inside it. */
export const FOCUS_MODE_SCOPE_ATTRIBUTE = 'data-focus-mode-scope';
/** Marks the button that opens a writing area's focus mode. */
export const FOCUS_MODE_TRIGGER_ATTRIBUTE = 'data-focus-mode-trigger';

/**
 * Opens the focus mode of the writing area that holds the keyboard focus, or of the fallback area
 * (the composer); false when there is none to open.
 */
export function openFocusModeFrom(activeElement: Element | null, fallback: HTMLElement | null): boolean {
    const scope = activeElement?.closest<HTMLElement>(`[${FOCUS_MODE_SCOPE_ATTRIBUTE}]`) ?? fallback;
    const trigger = scope?.querySelector<HTMLButtonElement>(`[${FOCUS_MODE_TRIGGER_ATTRIBUTE}]:not(:disabled)`);
    trigger?.click();
    return Boolean(trigger);
}
