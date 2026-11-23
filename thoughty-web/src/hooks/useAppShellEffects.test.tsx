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
    configRead: true,
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

  it('gives no tag a color until the stored settings have been read', async () => {
    const updateConfig = vi.fn().mockResolvedValue(true);
    const params = createParams({ allTags: ['focus'], config: {}, configRead: false, updateConfig });

    const { rerender } = renderHook(() => useAppShellEffects(params));
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    expect(updateConfig).not.toHaveBeenCalled();

    // Once read, the stored colors are kept and only the tag without one gets a color
    Object.assign(params, {
      allTags: ['focus', 'travel'],
      config: { tagMetadata: '{"focus":{"color":"#112233"}}' },
      configRead: true,
      serializedTagMetadata: '{"focus":{"color":"#112233"}}',
      tagMetadata: { focus: { color: '#112233' } },
    });
    rerender();

    await waitFor(() => expect(updateConfig).toHaveBeenCalledTimes(1));
    const saved = JSON.parse((updateConfig.mock.calls[0]![0] as { tagMetadata: string }).tagMetadata) as Record<string, { color: string }>;
    expect(saved.focus).toEqual({ color: '#112233' });
    expect(saved.travel?.color).toMatch(/^#[0-9A-F]{6}$/);
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