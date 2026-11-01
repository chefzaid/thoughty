import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { COMPOSER_FOCUS_STATE } from '../components/JournalView/composerFocusRoute';
import type { ViewType } from '../types';
import { appendToDraft, entryPermalinkPath, useAppQuickCapture } from './useAppQuickCapture';

function setup(currentView: ViewType | null, search = 'diary=all&page=3') {
  const options = {
    entriesService: { createEntry: vi.fn().mockResolvedValue({ success: true, entryId: 12 }) },
    notifier: { notify: vi.fn(), t: (key: string) => key, language: 'en' as const },
    currentView,
    searchParams: new URLSearchParams(search),
    navigate: vi.fn(),
    openView: vi.fn(),
    setComposerText: vi.fn(),
    onSaved: vi.fn(),
  };
  const { result } = renderHook(() => useAppQuickCapture(options));
  return { result, options };
}

describe('entryPermalinkPath', () => {
  it('is the journal address of the entry, without the origin', () => {
    expect(entryPermalinkPath(12)).toBe('/journal?entry=12');
  });
});

describe('appendToDraft', () => {
  it('adds the text after the composer’s draft, a blank line apart, or takes its place when empty', () => {
    expect(appendToDraft('', 'New')).toBe('New');
    expect(appendToDraft('  \n', 'New')).toBe('New');
    expect(appendToDraft('Morning pages\n', 'New')).toBe('Morning pages\n\nNew');
    expect(appendToDraft('Morning pages', '')).toBe('Morning pages');
  });
});

describe('useAppQuickCapture', () => {
  it('links the saved entry to its permalink and opens it there', async () => {
    const { result, options } = setup('stats');
    act(() => result.current.setText('Idea'));
    await act(() => result.current.save());

    expect(options.onSaved).toHaveBeenCalledTimes(1);
    const action = options.notifier.notify.mock.calls[0]![1] as { href: string; run: () => void };
    expect(action.href).toBe('/journal?entry=12');
    action.run();
    expect(options.navigate).toHaveBeenCalledWith('/journal?entry=12');
  });

  it('opens the journal on its composer from another view, adding the text to the draft', () => {
    const { result, options } = setup('stats');
    act(() => result.current.setText('Carry me'));
    act(() => result.current.openInFull());

    const update = options.setComposerText.mock.calls[0]![0] as (draft: string) => string;
    expect(update('Draft')).toBe('Draft\n\nCarry me');
    expect(options.openView).toHaveBeenCalledWith('journal', COMPOSER_FOCUS_STATE);
    expect(options.navigate).not.toHaveBeenCalled();
  });

  it('keeps the journal as it is when already there, moving only focus to the composer', () => {
    const { result, options } = setup('journal');
    act(() => result.current.openInFull());

    expect(options.navigate).toHaveBeenCalledWith({ pathname: '/journal', search: '?diary=all&page=3' }, { state: COMPOSER_FOCUS_STATE });
    expect(options.openView).not.toHaveBeenCalled();
  });
});
