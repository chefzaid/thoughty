import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { Config } from '../types';
import { assignMissingTagColors, serializeTagMetadata, type TagMetadataMap } from '../utils/tagMetadata';

interface UseAppShellEffectsParams {
  allTags: string[];
  config: Config;
  /** Whether the stored settings were really read: tag colors built on unread settings would replace the stored ones. */
  configRead: boolean;
  currentDiaryId: number | null;
  isAuthenticated: boolean;
  routeDiaryId: number | null | undefined;
  serializedTagMetadata: string;
  setCurrentDiaryId: Dispatch<SetStateAction<number | null>>;
  tagMetadata: TagMetadataMap;
  updateConfig: (newConfig: Config) => Promise<boolean>;
}

/**
 * What a tag color save was computed from: the tags and the settings it started on. A failed save puts
 * those same settings back, so the same input means "already tried"; a new tag or any other settings
 * change (such as a later successful save) gives a new input and a new attempt.
 */
function tagColorSyncInput(allTags: readonly string[], config: Config): string {
  return JSON.stringify([[...allTags].sort(), config]);
}

export function useAppShellEffects({
  allTags,
  config,
  configRead,
  currentDiaryId,
  isAuthenticated,
  routeDiaryId,
  serializedTagMetadata,
  setCurrentDiaryId,
  tagMetadata,
  updateConfig,
}: Readonly<UseAppShellEffectsParams>) {
  const lastTagColorSyncInput = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      lastTagColorSyncInput.current = null;
      return;
    }
    // Unread (still loading, or the read failed), the colors would start from none and be saved over the stored ones
    if (!configRead || allTags.length === 0) {
      return;
    }

    const nextTagMetadata = assignMissingTagColors(allTags, tagMetadata);
    const nextSerializedTagMetadata = serializeTagMetadata(nextTagMetadata);

    if (nextSerializedTagMetadata === serializedTagMetadata) {
      return;
    }

    // Each input is saved at most once, so a refused save does not post again after its rollback
    const input = tagColorSyncInput(allTags, config);
    if (input === lastTagColorSyncInput.current) {
      return;
    }
    lastTagColorSyncInput.current = input;

    void updateConfig({
      ...config,
      tagMetadata: nextSerializedTagMetadata,
    });
  }, [allTags, config, configRead, isAuthenticated, serializedTagMetadata, tagMetadata, updateConfig]);

  useEffect(() => {
    if (!isAuthenticated || routeDiaryId === undefined || routeDiaryId === currentDiaryId) {
      return;
    }

    setCurrentDiaryId(routeDiaryId);
  }, [currentDiaryId, isAuthenticated, routeDiaryId, setCurrentDiaryId]);
}
