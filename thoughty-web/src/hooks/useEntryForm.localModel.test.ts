import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderHook } from './hookTestUtils';
import { useEntryForm } from './useEntryActions';
import { makeDiary } from '../test/diaryFixture';
import { writeLocalModelSettings } from '../services/localModel/localModelSettings';

vi.mock('../contexts/AuthContext', async () => {
  const { authContextMock } = await import('./useEntryActions.test-helpers');
  const { useAuth } = authContextMock();
  return { useAuth: () => ({ ...useAuth(), user: { id: 7 } }) };
});
vi.mock('../services/api', async () => (await import('./useEntryActions.test-helpers')).apiModuleMock());

const diaries = [makeDiary({ id: 5, name: 'Letters', aiMode: 'local' })];
const answer = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

describe('useEntryForm in a diary on the writer’s own model', () => {
  let serverAi: { fixWriting: ReturnType<typeof vi.fn>; suggestTags: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    localStorage.clear();
    // The composer's draft, which the API holds none of
    const { mockAuthFetch } = await import('./useEntryActions.test-helpers');
    mockAuthFetch.mockImplementation(async () => new Response(JSON.stringify({ draft: null }), { status: 200 }));
    const { createAiService } = await import('../services/api');
    serverAi = { fixWriting: vi.fn(), suggestTags: vi.fn() };
    vi.mocked(createAiService).mockReturnValue(serverAi as unknown as ReturnType<typeof createAiService>);
  });

  afterEach(() => vi.unstubAllGlobals());

  const renderForm = (requestConsent = vi.fn()) => {
    const hook = renderHook(() => useEntryForm({ defaultVisibility: 'private', autoTagMaxTags: 3 }, 5, vi.fn(), diaries, undefined, requestConsent));
    act(() => {
      hook.result.current.setNewEntryText('dear sis, i miss you');
    });
    return hook;
  };

  it('rephrases and tags with that model from this browser, unasked, and never through the API', async () => {
    writeLocalModelSettings(7, { baseUrl: 'http://localhost:11434/v1', model: 'llama3.2', apiKey: '' });
    const fetchMock = vi.fn().mockResolvedValueOnce(answer('Dear sis, I miss you.')).mockResolvedValueOnce(answer('["family", "missing"]'));
    vi.stubGlobal('fetch', fetchMock);
    const requestConsent = vi.fn();
    const { result } = renderForm(requestConsent);
    expect(result.current.diaryAiMode).toBe('local');

    await act(async () => {
      await expect(result.current.handleFixWriting()).resolves.toBe(true);
    });
    expect(result.current.newEntryText).toBe('Dear sis, I miss you.');

    await act(async () => {
      await expect(result.current.handleSuggestTags()).resolves.toBe(true);
    });
    expect(result.current.tags).toEqual(['family', 'missing']);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => url === 'http://localhost:11434/v1/chat/completions')).toBe(true);
    expect(serverAi.fixWriting).not.toHaveBeenCalled();
    expect(serverAi.suggestTags).not.toHaveBeenCalled();
    expect(requestConsent).not.toHaveBeenCalled();
  });

  it('says to set the model up first when this browser has none', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderForm();

    await act(async () => {
      await expect(result.current.handleFixWriting()).resolves.toBe(false);
    });
    expect(result.current.formError).toBe('localModelNotConfigured');
    expect(result.current.newEntryText).toBe('dear sis, i miss you');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
