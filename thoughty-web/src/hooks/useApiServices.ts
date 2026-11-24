import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  createAiService,
  createAttachmentsService,
  createAuthFetch,
  createCloudSyncService,
  createConfigService,
  createDiariesService,
  createEntriesService,
} from '../services/api';
import { useLocalAiService } from './useLocalAiService';

export const useApiServices = () => {
  const { authFetch, getAccessToken } = useAuth();

  const authFetchHelper = useMemo(() => createAuthFetch(authFetch, getAccessToken), [authFetch, getAccessToken]);
  const configService = useMemo(() => createConfigService(authFetchHelper), [authFetchHelper]);
  const entriesService = useMemo(() => createEntriesService(authFetchHelper), [authFetchHelper]);
  const diariesService = useMemo(() => createDiariesService(authFetchHelper), [authFetchHelper]);
  const attachmentsService = useMemo(() => createAttachmentsService(authFetchHelper), [authFetchHelper]);
  const aiService = useMemo(() => createAiService(authFetchHelper), [authFetchHelper]);
  const cloudSyncService = useMemo(() => createCloudSyncService(authFetchHelper), [authFetchHelper]);
  // The diaries on the writer's own model: sent from this browser to the server set on it, never through the API
  const localAiService = useLocalAiService();

  return { authFetchHelper, configService, entriesService, diariesService, attachmentsService, aiService, cloudSyncService, localAiService };
};
