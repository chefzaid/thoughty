import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { Config } from '../types';
import { assignMissingTagColors, serializeTagMetadata, type TagMetadataMap } from '../utils/tagMetadata';

interface UseAppShellEffectsParams {
  allTags: string[];
  config: Config;
  currentDiaryId: number | null;
  isAuthenticated: boolean;
  routeDiaryId: number | null | undefined;
  serializedTagMetadata: string;
  setCurrentDiaryId: Dispatch<SetStateAction<number | null>>;
  tagMetadata: TagMetadataMap;
  updateConfig: (newConfig: Config) => Promise<void>;
}

export function useAppShellEffects({
  allTags,
  config,
  currentDiaryId,
  isAuthenticated,
  routeDiaryId,
  serializedTagMetadata,
  setCurrentDiaryId,
  tagMetadata,
  updateConfig,
}: Readonly<UseAppShellEffectsParams>) {
  useEffect(() => {
    if (!isAuthenticated || allTags.length === 0) {
      return;
    }

    const nextTagMetadata = assignMissingTagColors(allTags, tagMetadata);
    const nextSerializedTagMetadata = serializeTagMetadata(nextTagMetadata);

    if (nextSerializedTagMetadata === serializedTagMetadata) {
      return;
    }

    void updateConfig({
      ...config,
      tagMetadata: nextSerializedTagMetadata,
    });
  }, [allTags, config, isAuthenticated, serializedTagMetadata, tagMetadata, updateConfig]);

  useEffect(() => {
    if (!isAuthenticated || routeDiaryId === undefined || routeDiaryId === currentDiaryId) {
      return;
    }

    setCurrentDiaryId(routeDiaryId);
  }, [currentDiaryId, isAuthenticated, routeDiaryId, setCurrentDiaryId]);
}