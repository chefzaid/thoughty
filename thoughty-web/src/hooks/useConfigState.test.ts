import { describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

import { useConfig } from './useConfigState';
import { renderHook } from './hookTestUtils';

const mocks = vi.hoisted(() => ({
  fetchConfig: vi.fn(),
  fetchProfileStats: vi.fn(),
}));

vi.mock('./useApiServices', () => ({
  useApiServices: () => ({
    configService: {
      fetchConfig: mocks.fetchConfig,
      fetchProfileStats: mocks.fetchProfileStats,
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
