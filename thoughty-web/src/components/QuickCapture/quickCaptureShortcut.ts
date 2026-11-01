type ShortcutEvent = Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'key' | 'code'>;

/**
 * Ctrl+Shift+Space (Cmd+Shift+Space on a Mac) opens quick capture from anywhere in the signed-in app,
 * also while typing. Ctrl+Shift+N cannot be used: Chrome and Edge open a private window with it before
 * the page sees the key, and Firefox reopens a closed window. No browser, no other shortcut of the app
 * and none of the Markdown editor's uses Ctrl+Shift+Space.
 */
export function isQuickCaptureShortcut(event: ShortcutEvent): boolean {
    return (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey
        && (event.code === 'Space' || event.key === ' ');
}

/** The `aria-keyshortcuts` value of the shortcut. */
export const QUICK_CAPTURE_KEYSHORTCUTS = 'Control+Shift+Space Meta+Shift+Space';

/**
 * Whether a modal dialog is open (focus mode, the reader, a confirmation, Highlights...), over which quick
 * capture does not open: the writer is busy there, and two stacked dialogs would compete for the keyboard.
 */
export function isModalDialogOpen(root: ParentNode = document): boolean {
    return root.querySelector('[aria-modal="true"]') !== null;
}
