import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

import { useConfig } from './useConfigState';
import { renderHook } from './hookTestUtils';
import { readOfflineDisplay, rememberOfflineDisplay } from '../contexts/offlineSession';

const mocks = vi.hoisted(() => ({
  fetchConfig: vi.fn(),
  fetchProfileStats: vi.fn(),
}));

vi.mock('./useApiServices', () => ({
  useApiServices: () => ({
    configService: { fetchConfig: mocks.fetchConfig, fetchProfileStats: mocks.fetchProfileStats, updateConfig: vi.fn() },
  }),
}));

describe('useConfig › a journal opened offline', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.fetchProfileStats.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.className = '';
  });

  it('remembers how the app looks once the settings are read', async () => {
    mocks.fetchConfig.mockResolvedValue({ language: 'fr', theme: 'light', bio: 'Private words' });

    const { result } = renderHook(() => useConfig(true));

    await waitFor(() => expect(result.current.config.language).toBe('fr'));
    expect(readOfflineDisplay()).toEqual({ language: 'fr', theme: 'light' });
  });

  it('counts as loaded at once and keeps the remembered look while the settings cannot be read', async () => {
    rememberOfflineDisplay({ language: 'fr', theme: 'light' });
    mocks.fetchConfig.mockResolvedValue(null);

    const { result } = renderHook(() => useConfig(true, true));

    expect(result.current.configLoaded).toBe(true);
    expect(result.current.config).toEqual({ language: 'fr', theme: 'light' });
    await waitFor(() => expect(mocks.fetchConfig).toHaveBeenCalled());
    // Only the look is known: a setting built on its stored value is not saved over it
    expect(result.current.configRead).toBe(false);
    expect(result.current.config).toEqual({ language: 'fr', theme: 'light' });
    expect(result.current.t('offlineNotice')).toBe('Vous êtes hors ligne');
    expect(document.body.classList.contains('light-mode')).toBe(true);
    // A failed read never overwrites what was remembered
    expect(readOfflineDisplay()).toEqual({ language: 'fr', theme: 'light' });
  });

  it('falls back to the defaults offline when nothing was remembered, and to them online after a failed read', async () => {
    mocks.fetchConfig.mockResolvedValue(null);

    const offline = renderHook(() => useConfig(true, true));
    expect(offline.result.current.configLoaded).toBe(true);
    expect(offline.result.current.config).toEqual({});

    rememberOfflineDisplay({ language: 'fr' });
    const online = renderHook(() => useConfig(true));
    await waitFor(() => expect(online.result.current.configLoaded).toBe(true));
    expect(online.result.current.config).toEqual({});
  });
});
