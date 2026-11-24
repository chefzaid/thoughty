import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';

import { useConfig } from './useConfigState';
import { renderHook } from './hookTestUtils';
import { stubBrowserLanguages, stubSystemScheme } from '../test/systemScheme';

const mocks = vi.hoisted(() => ({
  fetchConfig: vi.fn(),
  fetchProfileStats: vi.fn(),
}));

vi.mock('./useApiServices', () => ({
  useApiServices: () => ({
    configService: { fetchConfig: mocks.fetchConfig, fetchProfileStats: mocks.fetchProfileStats, updateConfig: vi.fn() },
  }),
}));

const bodyTheme = () => (document.body.classList.contains('light-mode') ? 'light' : 'dark');

describe('useConfig display', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
    document.body.className = '';
    document.documentElement.lang = 'en';
  });

  it('shows a visitor the browser language and the system theme, on the page and in <html lang>', async () => {
    stubBrowserLanguages(['fr-CA', 'en']);
    stubSystemScheme(true);
    const { result } = renderHook(() => useConfig(false));

    expect(result.current.display).toEqual({ language: 'fr', theme: 'light' });
    expect(result.current.t('signIn')).toBe('Se connecter');
    await waitFor(() => expect(document.documentElement.lang).toBe('fr'));
    expect(bodyTheme()).toBe('light');
  });

  it('switches a visitor to what they pick on the public pages', async () => {
    stubBrowserLanguages(['fr-FR']);
    stubSystemScheme(false);
    const { result } = renderHook(() => useConfig(false));

    act(() => result.current.visitor.chooseLanguage('en'));
    act(() => result.current.visitor.chooseTheme('light'));
    expect(result.current.display).toEqual({ language: 'en', theme: 'light' });
    expect(result.current.t('signIn')).toBe('Sign In');
    await waitFor(() => expect(document.documentElement.lang).toBe('en'));
    expect(bodyTheme()).toBe('light');
  });

  it('shows a writer their saved settings over the browser and the visitor switch', async () => {
    stubBrowserLanguages(['en-US']);
    stubSystemScheme(true);
    localStorage.setItem('thoughty.visitorTheme', 'light');
    mocks.fetchConfig.mockResolvedValue({ language: 'fr', theme: 'dark' });
    mocks.fetchProfileStats.mockResolvedValue(null);
    const { result } = renderHook(() => useConfig(true));

    // Until the settings arrive the app shows its defaults, not the visitor's look
    expect(result.current.display).toEqual({ language: 'en', theme: 'dark' });
    await waitFor(() => expect(result.current.display).toEqual({ language: 'fr', theme: 'dark' }));
    await waitFor(() => expect(document.documentElement.lang).toBe('fr'));
    expect(bodyTheme()).toBe('dark');
    expect(result.current.t('signIn')).toBe('Se connecter');
  });

  it('reads a localized public page in its path’s language, for a visitor and a writer alike', async () => {
    stubBrowserLanguages(['fr-FR']);
    stubSystemScheme(false);
    const visitor = renderHook(() => useConfig(false, false, 'en'));
    expect(visitor.result.current.display.language).toBe('en');
    expect(visitor.result.current.preferredLanguage).toBe('fr');

    mocks.fetchConfig.mockResolvedValue({ language: 'en', theme: 'light' });
    mocks.fetchProfileStats.mockResolvedValue(null);
    const writer = renderHook(() => useConfig(true, false, 'fr'));
    // Where the English address sends a writer waits for their settings
    expect(writer.result.current.preferredLanguage).toBeNull();
    await waitFor(() => expect(writer.result.current.display).toEqual({ language: 'fr', theme: 'light' }));
    expect(writer.result.current.preferredLanguage).toBe('en');
    expect(writer.result.current.t('signIn')).toBe('Se connecter');
  });
});
