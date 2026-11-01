/**
 * Ctrl+Shift+E (Cmd+Shift+E on a Mac) blurs every entry text on screen, and shows it again. No other
 * shortcut of the app or of the Markdown editor uses it; Firefox's Network panel and Edge's sidebar search
 * share it and give way, since the page handles it first.
 */
export function isPrivacyBlurShortcut(event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'key'>): boolean {
    return (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'e';
}

/** The attribute on `<html>` while the privacy blur is on. */
export const PRIVACY_BLUR_ATTRIBUTE = 'data-privacy-blur';
