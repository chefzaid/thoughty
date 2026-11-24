import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useVisitorPreferences } from './useVisitorPreferences';
import { stubBrowserLanguages, stubSystemScheme } from '../test/systemScheme';

describe('useVisitorPreferences', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('follows the browser language and the system theme until the visitor picks others', () => {
    stubBrowserLanguages(['fr-FR', 'en']);
    stubSystemScheme(true);
    const { result } = renderHook(() => useVisitorPreferences());
    expect(result.current).toMatchObject({ language: 'fr', theme: 'light' });

    act(() => result.current.chooseLanguage('en'));
    act(() => result.current.chooseTheme('dark'));
    expect(result.current).toMatchObject({ language: 'en', theme: 'dark' });
    expect(localStorage.getItem('thoughty.visitorLanguage')).toBe('en');
    expect(localStorage.getItem('thoughty.visitorTheme')).toBe('dark');
  });

  it('starts from the choice this browser remembers', () => {
    stubBrowserLanguages(['en-US']);
    localStorage.setItem('thoughty.visitorLanguage', 'fr');
    localStorage.setItem('thoughty.visitorTheme', 'light');
    const { result } = renderHook(() => useVisitorPreferences());
    expect(result.current).toMatchObject({ language: 'fr', theme: 'light' });
  });

  it('follows a change of the system theme or of the browser languages', () => {
    const scheme = stubSystemScheme(false);
    stubBrowserLanguages(['en-US']);
    const { result, unmount } = renderHook(() => useVisitorPreferences());
    expect(result.current).toMatchObject({ language: 'en', theme: 'dark' });

    act(() => scheme.switchTo(true));
    stubBrowserLanguages(['fr']);
    act(() => {
      globalThis.dispatchEvent(new Event('languagechange'));
    });
    expect(result.current).toMatchObject({ language: 'fr', theme: 'light' });

    unmount();
    expect(scheme.listeners.size).toBe(0);
  });

  it('keeps a picked theme when the system changes', () => {
    const scheme = stubSystemScheme(false);
    const { result } = renderHook(() => useVisitorPreferences());
    act(() => result.current.chooseTheme('dark'));
    act(() => scheme.switchTo(true));
    expect(result.current.theme).toBe('dark');
  });

  it('reads the pages after a localized one in its language until the visitor picks one', () => {
    stubBrowserLanguages(['en-US']);
    const { result, rerender } = renderHook(({ page }) => useVisitorPreferences(page), {
      initialProps: { page: 'fr' as 'en' | 'fr' | null },
    });
    expect(result.current).toMatchObject({ language: 'fr', preferredLanguage: 'en' });

    // Sign-in, say, has no language in its path
    rerender({ page: null });
    expect(result.current.language).toBe('fr');

    rerender({ page: 'en' });
    rerender({ page: null });
    expect(result.current.language).toBe('en');

    rerender({ page: 'fr' });
    rerender({ page: null });
    act(() => result.current.chooseLanguage('en'));
    expect(result.current).toMatchObject({ language: 'en', preferredLanguage: 'en' });
    expect(localStorage.getItem('thoughty.visitorLanguage')).toBe('en');
  });
});
