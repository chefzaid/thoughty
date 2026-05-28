import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAppShellEffects } from './useAppShellEffects';

type UseAppShellEffectsParams = Parameters<typeof useAppShellEffects>[0];

function createParams(
  overrides: Partial<UseAppShellEffectsParams> = {},
): UseAppShellEffectsParams {
  return {
    allTags: [],
    config: {
      theme: 'dark',
      tagMetadata: '{}',
    },
    currentDiaryId: null,
    isAuthenticated: true,
    routeDiaryId: undefined,
    serializedTagMetadata: '{}',
    setCurrentDiaryId: vi.fn(),
    tagMetadata: {},
    updateConfig: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('useAppShellEffects', () => {
  it('assigns missing tag colors when authenticated tags have no metadata', async () => {
    const updateConfig = vi.fn().mockResolvedValue(undefined);

    renderHook(() => useAppShellEffects(createParams({
      allTags: ['focus'],
      updateConfig,
    })));

    await waitFor(() => {
      expect(updateConfig).toHaveBeenCalledTimes(1);
    });

    const nextConfig = updateConfig.mock.calls[0]![0] as { tagMetadata?: string };
    expect(nextConfig.tagMetadata).not.toBe('{}');
    expect(JSON.parse(nextConfig.tagMetadata ?? '{}')).toMatchObject({
      focus: {
        color: expect.stringMatching(/^#[0-9A-F]{6}$/),
      },
    });
  });

  it('syncs the current diary from the route when authenticated', async () => {
    const setCurrentDiaryId = vi.fn();

    renderHook(() => useAppShellEffects(createParams({
      currentDiaryId: 1,
      routeDiaryId: 5,
      setCurrentDiaryId,
    })));

    await waitFor(() => {
      expect(setCurrentDiaryId).toHaveBeenCalledWith(5);
    });
  });
});