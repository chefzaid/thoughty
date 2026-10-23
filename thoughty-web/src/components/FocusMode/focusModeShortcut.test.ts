import { describe, expect, it, vi } from 'vitest';
import { isFocusModeShortcut, openFocusModeFrom } from './focusModeShortcut';

describe('focusModeShortcut', () => {
    const key = (overrides: Partial<KeyboardEvent>) => ({ ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, key: 'f', ...overrides });

    it('is Ctrl+Shift+F, or Cmd+Shift+F on a Mac', () => {
        expect(isFocusModeShortcut(key({ ctrlKey: true, shiftKey: true, key: 'F' }))).toBe(true);
        expect(isFocusModeShortcut(key({ metaKey: true, shiftKey: true }))).toBe(true);
        expect(isFocusModeShortcut(key({ ctrlKey: true }))).toBe(false);
        expect(isFocusModeShortcut(key({ shiftKey: true }))).toBe(false);
        expect(isFocusModeShortcut(key({ ctrlKey: true, shiftKey: true, altKey: true }))).toBe(false);
        expect(isFocusModeShortcut(key({ ctrlKey: true, shiftKey: true, key: 'g' }))).toBe(false);
    });

    it('opens the focus mode of the writing area holding the focus, else the fallback one', () => {
        document.body.innerHTML = `
            <div id="composer" data-focus-mode-scope><button data-focus-mode-trigger id="composer-trigger"></button></div>
            <div data-focus-mode-scope><textarea id="editor"></textarea><button data-focus-mode-trigger id="editor-trigger"></button></div>
            <input id="search" />`;
        const clicks: string[] = [];
        for (const id of ['composer-trigger', 'editor-trigger']) {
            document.getElementById(id)?.addEventListener('click', () => clicks.push(id));
        }
        const composer = document.getElementById('composer');

        expect(openFocusModeFrom(document.getElementById('editor'), composer)).toBe(true);
        expect(openFocusModeFrom(document.getElementById('search'), composer)).toBe(true);
        expect(openFocusModeFrom(null, null)).toBe(false);
        expect(clicks).toEqual(['editor-trigger', 'composer-trigger']);
    });

    it('does nothing when the trigger is disabled', () => {
        document.body.innerHTML = '<div id="scope" data-focus-mode-scope><button data-focus-mode-trigger disabled></button></div>';
        const onClick = vi.fn();
        document.querySelector('button')?.addEventListener('click', onClick);

        expect(openFocusModeFrom(null, document.getElementById('scope'))).toBe(false);
        expect(onClick).not.toHaveBeenCalled();
    });
});
