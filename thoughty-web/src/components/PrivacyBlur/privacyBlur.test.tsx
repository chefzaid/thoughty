import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { translations } from '../../utils/translations';
import { isPrivacyBlurShortcut, PRIVACY_BLUR_ATTRIBUTE } from './privacyBlur';
import PrivacyBlurButton from './PrivacyBlurButton';
import { usePrivacyBlur } from './usePrivacyBlur';

const key = (overrides: Partial<KeyboardEvent>) => ({ ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, key: 'e', ...overrides });
const isBlurred = () => document.documentElement.hasAttribute(PRIVACY_BLUR_ATTRIBUTE);
const pressShortcut = (init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key: 'E', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true, ...init });
    act(() => { document.body.dispatchEvent(event); });
    return event;
};

function Harness() {
    const privacyBlur = usePrivacyBlur();
    return <PrivacyBlurButton privacyBlur={privacyBlur} className="nav-icon-btn" t={(text) => text} />;
}

afterEach(() => {
    document.documentElement.removeAttribute(PRIVACY_BLUR_ATTRIBUTE);
});

describe('isPrivacyBlurShortcut', () => {
    it('is Ctrl+Shift+E, or Cmd+Shift+E on a Mac', () => {
        expect(isPrivacyBlurShortcut(key({ ctrlKey: true, shiftKey: true, key: 'E' }))).toBe(true);
        expect(isPrivacyBlurShortcut(key({ metaKey: true, shiftKey: true }))).toBe(true);
        expect(isPrivacyBlurShortcut(key({ ctrlKey: true }))).toBe(false);
        expect(isPrivacyBlurShortcut(key({ shiftKey: true }))).toBe(false);
        expect(isPrivacyBlurShortcut(key({ ctrlKey: true, shiftKey: true, altKey: true }))).toBe(false);
        expect(isPrivacyBlurShortcut(key({ ctrlKey: true, shiftKey: true, key: 'F' }))).toBe(false);
    });
});

describe('usePrivacyBlur', () => {
    it('starts off and toggles the mark on <html>', () => {
        const { result } = renderHook(() => usePrivacyBlur());
        expect(result.current).toMatchObject({ blurred: false, changed: false });
        expect(isBlurred()).toBe(false);

        act(() => result.current.toggle());
        expect(result.current).toMatchObject({ blurred: true, changed: true });
        expect(isBlurred()).toBe(true);

        act(() => result.current.toggle());
        expect(result.current.blurred).toBe(false);
        expect(isBlurred()).toBe(false);
    });

    it('toggles with the shortcut, also from a text field, and ignores held keys and other keys', () => {
        const { result } = renderHook(() => usePrivacyBlur());

        const event = pressShortcut();
        expect(event.defaultPrevented).toBe(true);
        expect(result.current.blurred).toBe(true);

        expect(pressShortcut({ repeat: true }).defaultPrevented).toBe(true);
        expect(result.current.blurred).toBe(true);

        expect(pressShortcut({ key: 'f' }).defaultPrevented).toBe(false);
        expect(result.current.blurred).toBe(true);

        const field = document.createElement('textarea');
        document.body.append(field);
        act(() => { field.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', metaKey: true, shiftKey: true, bubbles: true })); });
        expect(result.current.blurred).toBe(false);
        field.remove();
    });

    it('shows the text again and stops listening when the signed-in app goes away', () => {
        const { result, unmount } = renderHook(() => usePrivacyBlur());
        act(() => result.current.toggle());
        unmount();

        expect(isBlurred()).toBe(false);
        expect(pressShortcut().defaultPrevented).toBe(false);
        expect(isBlurred()).toBe(false);
    });
});

describe('PrivacyBlurButton', () => {
    it('is a named toggle button that says when entry text is blurred or shown', () => {
        render(<Harness />);
        const button = screen.getByRole('button', { name: 'privacyBlur' });
        const status = screen.getByRole('status');
        expect(button).toHaveAttribute('aria-pressed', 'false');
        expect(button).toHaveAttribute('aria-keyshortcuts', 'Control+Shift+E Meta+Shift+E');
        expect(button).toHaveAttribute('title', 'privacyBlurHint');
        expect(status).toBeEmptyDOMElement();

        fireEvent.click(button);
        expect(button).toHaveAttribute('aria-pressed', 'true');
        expect(status).toHaveTextContent('privacyBlurOnAnnouncement');
        expect(isBlurred()).toBe(true);

        pressShortcut();
        expect(button).toHaveAttribute('aria-pressed', 'false');
        expect(status).toHaveTextContent('privacyBlurOffAnnouncement');
        expect(isBlurred()).toBe(false);
    });

    it('names the button and the shortcut in English and French', () => {
        expect(translations.en.privacyBlur).toBe('Blur entry text');
        expect(translations.en.privacyBlurHint).toContain('Ctrl+Shift+E');
        expect(translations.fr.privacyBlur).toBe('Flouter le texte des entrées');
        expect(translations.fr.privacyBlurHint).toContain('Ctrl+Maj+E');
    });
});
