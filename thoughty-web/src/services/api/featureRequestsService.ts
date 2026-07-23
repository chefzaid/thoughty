import type { components, paths } from '../../generated/openapi';
import { readApiErrorMessage, safeJsonParse, type AuthFetchFunction } from './base';

export type FeatureRequest = components['schemas']['FeatureRequestDto'];
type CreateFeatureRequest = components['schemas']['CreateFeatureRequestDto'];
type FeatureRequestListResponse =
  paths['/api/feature-requests']['get']['responses'][200]['content']['application/json'];
type FeatureRequestVotesResponse =
  paths['/api/feature-requests/votes']['get']['responses'][200]['content']['application/json'];
type FeatureRequestVoteResponse =
  paths['/api/feature-requests/{id}/vote']['post']['responses'][201]['content']['application/json'];

async function requireJson<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  const data = await safeJsonParse<T>(response);
  if (!data) {
    throw new Error(fallbackMessage);
  }
  return data;
}

export function createFeatureRequestsService(authFetch: AuthFetchFunction) {
  return {
    async list(): Promise<FeatureRequest[]> {
      const response = await authFetch('/api/feature-requests');
      const data = await requireJson<FeatureRequestListResponse>(
        response,
        'Failed to load feature requests',
      );
      return data.requests;
    },

    async getVotedRequestIds(): Promise<number[]> {
      const response = await authFetch('/api/feature-requests/votes');
      const data = await requireJson<FeatureRequestVotesResponse>(
        response,
        'Failed to load votes',
      );
      return data.requestIds;
    },

    async create(payload: CreateFeatureRequest): Promise<FeatureRequest> {
      const response = await authFetch('/api/feature-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return requireJson<FeatureRequest>(response, 'Failed to submit feature request');
    },

    async vote(requestId: number): Promise<FeatureRequestVoteResponse> {
      const response = await authFetch(`/api/feature-requests/${requestId}/vote`, {
        method: 'POST',
      });
      return requireJson<FeatureRequestVoteResponse>(response, 'Failed to record vote');
    },
  };
}
