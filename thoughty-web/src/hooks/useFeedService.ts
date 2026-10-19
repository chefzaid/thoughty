import { createFeedService } from '../services/api';
import { useAuthenticatedService } from './useAuthenticatedService';

export function useFeedService() {
  return useAuthenticatedService(createFeedService);
}
