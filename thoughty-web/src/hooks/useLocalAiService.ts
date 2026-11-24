import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { createLocalAiService } from '../services/localModel/localAiService';
import { readLocalModelSettings } from '../services/localModel/localModelSettings';

/**
 * The AI actions of the diaries on the signed-in writer's own model: sent from this browser to the server set on
 * it in this browser, never through Thoughty's API.
 */
export function useLocalAiService() {
  const userId = useAuth().user?.id ?? null;
  return useMemo(() => createLocalAiService(() => readLocalModelSettings(userId), userId), [userId]);
}
