import { act, waitFor } from '@testing-library/react';
import { useMemo } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAppShellEffects } from './useAppShellEffects';
import { useConfig } from './useConfigState';
import { renderHook } from './hookTestUtils';
import { parseTagMetadata, serializeTagMetadata } from '../utils/tagMetadata';

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

/**
 * The app shell's tag color sync on top of the real settings state, which puts the old settings back after a
 * failed save. Like the journal list, the tags arrive once the settings have loaded.
 */
async function renderTagColorSync(initialTags: string[]) {
  const props = { allTags: [] as string[], isAuthenticated: true };
  const hook = renderHook(() => {
    const configState = useConfig(props.isAuthenticated);
    const tagMetadata = useMemo(() => parseTagMetadata(configState.config.tagMetadata), [configState.config.tagMetadata]);
    useAppShellEffects({
      allTags: props.allTags,
      config: configState.config,
      currentDiaryId: null,
      isAuthenticated: props.isAuthenticated,
      routeDiaryId: undefined,
      serializedTagMetadata: serializeTagMetadata(tagMetadata),
      setCurrentDiaryId: vi.fn(),
      tagMetadata,
      updateConfig: configState.updateConfig,
    });
    return configState;
  });
  const update = (next: Partial<typeof props>) => {
    Object.assign(props, next);
    hook.rerender();
  };
  await waitFor(() => expect(hook.result.current.configLoaded).toBe(true));
  update({ allTags: initialTags });
  return { ...hook, update };
}

/** Lets pending saves, rollbacks and the effects they trigger settle (the query cache tells React on a timer). */
async function settle() {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await new Promise((resolve) => { setTimeout(resolve, 5); });
    });
  }
}

const savedTagColors = (callIndex: number) =>
  Object.keys(parseTagMetadata((mocks.updateConfig.mock.calls[callIndex]![0] as { tagMetadata?: string }).tagMetadata));

describe('useAppShellEffects tag color sync', () => {
  beforeEach(() => {
    mocks.fetchConfig.mockReset().mockResolvedValue({ theme: 'dark', tagMetadata: '{}' });
    mocks.fetchProfileStats.mockReset().mockResolvedValue(null);
    mocks.updateConfig.mockReset();
  });

  it('tries a failing save once instead of posting again after each rollback', async () => {
    mocks.updateConfig.mockResolvedValue(false);
    const { result } = await renderTagColorSync(['focus']);

    await waitFor(() => expect(mocks.updateConfig).toHaveBeenCalledTimes(1));
    await settle();

    expect(mocks.updateConfig).toHaveBeenCalledTimes(1);
    expect(savedTagColors(0)).toEqual(['focus']);
    expect(result.current.config.tagMetadata).toBe('{}');
  });

  it('tries again only when the tags change, then keeps the colors once a save goes through', async () => {
    mocks.updateConfig.mockResolvedValue(false);
    const { result, rerender, update } = await renderTagColorSync(['focus']);
    await waitFor(() => expect(mocks.updateConfig).toHaveBeenCalledTimes(1));

    rerender();
    await settle();
    expect(mocks.updateConfig).toHaveBeenCalledTimes(1);

    mocks.updateConfig.mockResolvedValue(true);
    update({ allTags: ['focus', 'travel'] });
    await waitFor(() => expect(mocks.updateConfig).toHaveBeenCalledTimes(2));
    await settle();

    expect(mocks.updateConfig).toHaveBeenCalledTimes(2);
    expect(savedTagColors(1)).toEqual(['focus', 'travel']);
    expect(Object.keys(parseTagMetadata(result.current.config.tagMetadata))).toEqual(['focus', 'travel']);
  });

  it('tries again after another settings change goes through', async () => {
    mocks.updateConfig.mockResolvedValue(false);
    const { result } = await renderTagColorSync(['focus']);
    await waitFor(() => expect(mocks.updateConfig).toHaveBeenCalledTimes(1));
    await settle();

    mocks.updateConfig.mockResolvedValue(true);
    await act(async () => {
      await result.current.updateConfig({ ...result.current.config, theme: 'light' });
    });
    await settle();

    expect(mocks.updateConfig).toHaveBeenCalledTimes(3);
    expect(mocks.updateConfig.mock.calls[2]![0]).toMatchObject({ theme: 'light' });
    expect(savedTagColors(2)).toEqual(['focus']);
    expect(Object.keys(parseTagMetadata(result.current.config.tagMetadata))).toEqual(['focus']);
  });

  it('tries again after signing out and back in', async () => {
    mocks.updateConfig.mockResolvedValue(false);
    const { update } = await renderTagColorSync(['focus']);
    await waitFor(() => expect(mocks.updateConfig).toHaveBeenCalledTimes(1));
    await settle();

    update({ isAuthenticated: false });
    await settle();
    update({ isAuthenticated: true });

    await waitFor(() => expect(mocks.updateConfig).toHaveBeenCalledTimes(2));
    await settle();
    expect(mocks.updateConfig).toHaveBeenCalledTimes(2);
  });
});
