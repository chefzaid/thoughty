import { describe, expect, it, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';

import { useConfig, useReportedConfigUpdate } from './useConfigState';
import type { Notifier } from './useAppNotice';
import { renderHook } from './hookTestUtils';

const mocks = vi.hoisted(() => ({
  fetchConfig: vi.fn(),
  fetchProfileStats: vi.fn(),
  updateConfig: vi.fn(),
}));

vi.mock('./useApiServices', () => ({
  useApiServices: () => ({
    configService: {
      fetchConfig: mocks.fetchConfig,
      fetchProfileStats: mocks.fetchProfileStats,
      updateConfig: mocks.updateConfig,
    },
  }),
}));

describe('useConfig', () => {
  it('reports when the config has loaded', async () => {
    mocks.fetchConfig.mockResolvedValue({ entriesPerPage: 25 });
    mocks.fetchProfileStats.mockResolvedValue(null);

    const { result } = renderHook(() => useConfig(true));

    expect(result.current.configLoaded).toBe(false);
    await waitFor(() => {
      expect(result.current.configLoaded).toBe(true);
    });
    expect(result.current.config.entriesPerPage).toBe(25);
  });

  it('counts a failed config request as loaded so lookups fall back to the default page size', async () => {
    mocks.fetchConfig.mockRejectedValue(new Error('offline'));
    mocks.fetchProfileStats.mockResolvedValue(null);

    const { result } = renderHook(() => useConfig(true));

    await waitFor(() => {
      expect(result.current.configLoaded).toBe(true);
    });
    expect(result.current.config).toEqual({});
  });

  it('is not loaded while signed out', () => {
    const { result } = renderHook(() => useConfig(false));

    expect(result.current.configLoaded).toBe(false);
  });
});

describe('useConfig updateConfig', () => {
  it('shows the new settings and resolves true once they are saved', async () => {
    mocks.fetchConfig.mockResolvedValue({ theme: 'dark' });
    mocks.fetchProfileStats.mockResolvedValue(null);
    mocks.updateConfig.mockResolvedValue(true);
    const { result } = renderHook(() => useConfig(true));
    await waitFor(() => expect(result.current.config.theme).toBe('dark'));

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.updateConfig({ theme: 'light' });
    });

    expect(saved).toBe(true);
    expect(mocks.updateConfig).toHaveBeenCalledWith({ theme: 'light' });
    await waitFor(() => expect(result.current.config.theme).toBe('light'));
    expect(document.body).toHaveClass('light-mode');
  });

  it('shows the new settings while saving, then puts the previous ones back and resolves false when the save fails', async () => {
    mocks.fetchConfig.mockResolvedValue({ theme: 'dark', entryTemplates: '[]' });
    mocks.fetchProfileStats.mockResolvedValue(null);
    let finish: (saved: boolean) => void = () => undefined;
    mocks.updateConfig.mockImplementation(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useConfig(true));
    await waitFor(() => expect(result.current.config.theme).toBe('dark'));

    let pending: Promise<boolean> = Promise.resolve(true);
    act(() => {
      pending = result.current.updateConfig({ theme: 'light', entryTemplates: '[{"name":"Weekly"}]' });
    });
    await waitFor(() => expect(result.current.config.theme).toBe('light'));

    let saved: boolean | undefined;
    await act(async () => {
      finish(false);
      saved = await pending;
    });

    expect(saved).toBe(false);
    await waitFor(() => expect(result.current.config).toEqual({ theme: 'dark', entryTemplates: '[]' }));
    expect(document.body).toHaveClass('dark-mode');
  });
});

describe('useReportedConfigUpdate', () => {
  const createNotifier = (): Notifier => ({
    notify: vi.fn(),
    t: (key: string) => `translated:${key}`,
    language: 'en',
  });

  it('passes a successful save through without a message', async () => {
    const notifier = createNotifier();
    const updateConfig = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useReportedConfigUpdate(updateConfig, notifier));

    await expect(result.current({ theme: 'light' })).resolves.toBe(true);
    expect(updateConfig).toHaveBeenCalledWith({ theme: 'light' });
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it('says in the notice when the settings could not be saved and resolves false', async () => {
    const notifier = createNotifier();
    const updateConfig = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() => useReportedConfigUpdate(updateConfig, notifier));

    await expect(result.current({ theme: 'light' })).resolves.toBe(false);
    expect(notifier.notify).toHaveBeenCalledWith('translated:settingsSaveFailed');
  });
});
