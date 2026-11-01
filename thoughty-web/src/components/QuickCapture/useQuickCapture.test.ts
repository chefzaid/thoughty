import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Notifier } from '../../hooks/useAppNotice';
import { isModalDialogOpen, isQuickCaptureShortcut, QUICK_CAPTURE_KEYSHORTCUTS } from './quickCaptureShortcut';
import { useQuickCapture } from './useQuickCapture';

const key = (overrides: Partial<KeyboardEvent>) => ({
    ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, key: ' ', code: 'Space', ...overrides,
});

describe('isQuickCaptureShortcut', () => {
    it('is Ctrl+Shift+Space, or Cmd+Shift+Space on a Mac', () => {
        expect(isQuickCaptureShortcut(key({ ctrlKey: true, shiftKey: true }))).toBe(true);
        expect(isQuickCaptureShortcut(key({ metaKey: true, shiftKey: true }))).toBe(true);
        // A synthetic event may carry only the key
        expect(isQuickCaptureShortcut(key({ ctrlKey: true, shiftKey: true, code: '' }))).toBe(true);
        expect(isQuickCaptureShortcut(key({ ctrlKey: true }))).toBe(false);
        expect(isQuickCaptureShortcut(key({ shiftKey: true }))).toBe(false);
        expect(isQuickCaptureShortcut(key({ ctrlKey: true, shiftKey: true, altKey: true }))).toBe(false);
        // Ctrl+Shift+N belongs to the browser
        expect(isQuickCaptureShortcut(key({ ctrlKey: true, shiftKey: true, key: 'N', code: 'KeyN' }))).toBe(false);
        expect(QUICK_CAPTURE_KEYSHORTCUTS).toBe('Control+Shift+Space Meta+Shift+Space');
    });
});

describe('isModalDialogOpen', () => {
    afterEach(() => document.body.replaceChildren());

    it('sees a modal dialog, not a popover', () => {
        expect(isModalDialogOpen()).toBe(false);
        const popover = document.createElement('div');
        popover.setAttribute('role', 'dialog');
        document.body.append(popover);
        expect(isModalDialogOpen()).toBe(false);
        popover.setAttribute('aria-modal', 'true');
        expect(isModalDialogOpen()).toBe(true);
    });
});

function setup(createEntry = vi.fn().mockResolvedValue({ success: true, entryId: 42 })) {
    const notifier: Notifier = { notify: vi.fn(), t: (text) => `t:${text}`, language: 'en' };
    const options = {
        entriesService: { createEntry },
        notifier,
        onSaved: vi.fn(),
        entryPath: (entryId: number) => `/journal?entry=${entryId}`,
        onOpenEntry: vi.fn(),
        onOpenInFull: vi.fn(),
    };
    const hook = renderHook(() => useQuickCapture(options));
    return { ...hook, options, createEntry, notifier };
}

describe('useQuickCapture', () => {
    afterEach(() => vi.useRealTimers());

    it('saves the text as a private plain entry for the writer’s today in the default diary', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 10, 1, 23, 30));
        const { result, options, createEntry, notifier } = setup();

        act(() => result.current.open());
        act(() => result.current.setText('  Call the plumber  '));
        await act(() => result.current.save());

        expect(createEntry).toHaveBeenCalledWith({
            text: 'Call the plumber',
            tags: [],
            date: '2026-11-01',
            visibility: 'private',
            format: 'plain',
            diaryId: null,
        });
        expect(result.current).toMatchObject({ isOpen: false, text: '', error: '', saving: false });
        expect(options.onSaved).toHaveBeenCalledTimes(1);
        expect(notifier.notify).toHaveBeenCalledWith('t:quickCaptureSaved', {
            label: 't:quickCaptureViewEntry',
            href: '/journal?entry=42',
            run: expect.any(Function),
        });
        const action = vi.mocked(notifier.notify).mock.calls[0]![1]!;
        action.run();
        expect(options.onOpenEntry).toHaveBeenCalledWith(42);
    });

    it('asks for text instead of saving an empty entry', async () => {
        const { result, createEntry } = setup();

        act(() => result.current.open());
        act(() => result.current.setText('   '));
        await act(() => result.current.save());

        expect(createEntry).not.toHaveBeenCalled();
        expect(result.current).toMatchObject({ isOpen: true, error: 'entryTextRequired' });
        // Opening again starts without the old message
        act(() => result.current.close());
        act(() => result.current.open());
        expect(result.current.error).toBe('');
    });

    it('keeps the text and the box open with the API’s message when the save fails', async () => {
        const createEntry = vi.fn()
            .mockResolvedValueOnce({ success: false, error: 'apiError_VALIDATION_FAILED' })
            .mockResolvedValueOnce({ success: false });
        const { result, options, notifier } = setup(createEntry);

        act(() => result.current.open());
        act(() => result.current.setText('Remember the keys'));
        await act(() => result.current.save());
        expect(result.current).toMatchObject({ isOpen: true, text: 'Remember the keys', error: 'apiError_VALIDATION_FAILED', saving: false });

        await act(() => result.current.save());
        expect(result.current.error).toBe('entrySaveFailed');
        expect(options.onSaved).not.toHaveBeenCalled();
        expect(notifier.notify).not.toHaveBeenCalled();
    });

    it('saves once while a save is on its way', async () => {
        let finish: (value: { success: boolean; entryId: number }) => void = () => undefined;
        const createEntry = vi.fn(() => new Promise<{ success: boolean; entryId: number }>((resolve) => { finish = resolve; }));
        const { result } = setup(createEntry);

        act(() => result.current.setText('Once'));
        let first: Promise<void> = Promise.resolve();
        act(() => { first = result.current.save(); });
        expect(result.current.saving).toBe(true);
        await act(() => result.current.save());
        expect(createEntry).toHaveBeenCalledTimes(1);

        await act(async () => {
            finish({ success: true, entryId: 7 });
            await first;
        });
        expect(result.current.saving).toBe(false);
    });

    it('carries the trimmed text to the composer and closes', () => {
        const { result, options } = setup();

        act(() => result.current.open());
        act(() => result.current.setText(' Longer thought '));
        act(() => result.current.openInFull());

        expect(options.onOpenInFull).toHaveBeenCalledWith('Longer thought');
        expect(result.current).toMatchObject({ isOpen: false, text: '' });
    });

    it('keeps the text when closed without saving', () => {
        const { result } = setup();

        act(() => result.current.open());
        act(() => result.current.setText('Half a thought'));
        act(() => result.current.close());
        expect(result.current).toMatchObject({ isOpen: false, text: 'Half a thought' });
    });
});
