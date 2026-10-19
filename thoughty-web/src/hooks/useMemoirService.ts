import { createMemoirService } from '../services/api';
import { useAuthenticatedService } from './useAuthenticatedService';

export function useMemoirService() {
  return useAuthenticatedService(createMemoirService);
}
