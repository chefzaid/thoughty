import { requestJson, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type MemoirOverview = components['schemas']['MemoirOverviewDto'];
export type MemoirProgram = components['schemas']['MemoirProgramDto'];
export type MemoirChapter = components['schemas']['MemoirChapterDto'];
export type MemoirQuestion = components['schemas']['MemoirQuestionDto'];
export type MemoirProgress = components['schemas']['MemoirProgressDto'];
export type LocalizedText = components['schemas']['LocalizedTextDto'];
export type StartMemoirRequest = components['schemas']['StartMemoirDto'];
export type UpdateMemoirRequest = components['schemas']['UpdateMemoirDto'];
export type AnswerMemoirRequest = components['schemas']['AnswerMemoirQuestionDto'];
export type MemoirAnswerResult = components['schemas']['MemoirAnswerResultDto'];
export type MemoirLeft = components['schemas']['MemoirLeftDto'];

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const createMemoirService = (authFetch: (url: string, options?: RequestInit) => Promise<Response>) => ({
  fetchOverview(): Promise<ServiceResult<MemoirOverview>> {
    return requestJson(authFetch('/api/memoir'), 'Failed to load the memoir');
  },

  start(request: StartMemoirRequest): Promise<ServiceResult<MemoirOverview>> {
    return requestJson(
      authFetch('/api/memoir', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(request) }),
      'Failed to start the memoir',
    );
  },

  update(request: UpdateMemoirRequest): Promise<ServiceResult<MemoirOverview>> {
    return requestJson(
      authFetch('/api/memoir', { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(request) }),
      'Failed to save memoir settings',
    );
  },

  leave(): Promise<ServiceResult<MemoirLeft>> {
    return requestJson(authFetch('/api/memoir', { method: 'DELETE' }), 'Failed to stop the memoir');
  },

  skip(): Promise<ServiceResult<MemoirOverview>> {
    return requestJson(authFetch('/api/memoir/skip', { method: 'POST' }), 'Failed to skip the question');
  },

  answer(request: AnswerMemoirRequest): Promise<ServiceResult<MemoirAnswerResult>> {
    return requestJson(
      authFetch('/api/memoir/answers', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(request) }),
      'Failed to save the answer',
    );
  },
});

export type MemoirService = ReturnType<typeof createMemoirService>;
