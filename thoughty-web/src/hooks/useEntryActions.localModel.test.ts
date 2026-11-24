import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { renderHook } from './hookTestUtils';
import { useBulkSelect, useEntryEdit } from './useEntryActions';
import { createAiServiceMock, createEntriesServiceMock, mockNotify, notifier } from './useEntryActions.test-helpers';
import { writeLocalModelSettings } from '../services/localModel/localModelSettings';

vi.mock('../contexts/AuthContext', async () => {
  const { authContextMock } = await import('./useEntryActions.test-helpers');
  const { useAuth } = authContextMock();
  return { useAuth: () => ({ ...useAuth(), user: { id: 7 } }) };
});
vi.mock('../services/api', async () => (await import('./useEntryActions.test-helpers')).apiModuleMock());

const diaries = [{ id: 1, aiMode: 'on' as const }, { id: 2, aiMode: 'local' as const }];
const entry = (id: number, diaryId: number, tags = ['focus']) => ({
  id, content: `Entry ${id}`, tags, date: '2024-01-15', visibility: 'private' as const, diary_id: diaryId, index: 1,
});
const answer = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  writeLocalModelSettings(7, { baseUrl: 'https://models.home.example/v1', model: 'qwen2.5', apiKey: '', transcriptionModel: '' });
});

afterEach(() => vi.unstubAllGlobals());

describe('the entry actions of a diary on the writer’s own model', () => {
  it('tag an edited entry with that model once saved, and say when it gave no tags', async () => {
    const updateEntry = vi.fn().mockResolvedValue(true);
    const bulkOperation = vi.fn().mockResolvedValue({ success: true, affectedCount: 1 });
    await createEntriesServiceMock({ updateEntry, bulkOperation });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(answer('["calm", "sea"]')).mockRejectedValue(new TypeError('Failed to fetch')));
    const onSave = vi.fn();
    const { result } = renderHook(() => useEntryEdit({ autoTagMaxTags: '2' }, onSave, notifier, undefined, diaries));

    act(() => result.current.handleEdit(entry(5, 2, [])));
    await act(async () => {
      await result.current.handleSaveEdit();
    });
    expect(updateEntry).toHaveBeenCalledWith(5, expect.objectContaining({ tags: [] }));
    await waitFor(() => expect(bulkOperation).toHaveBeenCalledWith([5], 'tags', { tags: ['calm', 'sea'] }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));

    act(() => result.current.handleEdit(entry(6, 2, ['one'])));
    await act(async () => {
      await result.current.handleSaveEdit();
    });
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('The entry is saved, but your own model added no tags to it. Test the connection in Profile › AI Configuration to see why.'));

    // An entry of a diary with AI on is tagged by the server as it saves
    act(() => result.current.handleEdit(entry(7, 1, [])));
    await act(async () => {
      await result.current.handleSaveEdit();
    });
    expect(bulkOperation).toHaveBeenCalledTimes(1);
  });

  it('bulk rephrase sends that diary’s entries to that model, and says why it rephrased none', async () => {
    const updateEntry = vi.fn().mockResolvedValue(true);
    const fixWriting = vi.fn().mockResolvedValue({ data: 'Improved', refusal: null });
    await createEntriesServiceMock({ updateEntry });
    await createAiServiceMock({ fixWriting });
    const fetchMock = vi.fn().mockResolvedValue(answer('<text>\nImproved here\n</text>'));
    vi.stubGlobal('fetch', fetchMock);
    const onComplete = vi.fn();

    const { result } = renderHook(() => useBulkSelect(onComplete, [entry(1, 1), entry(2, 2)], notifier, undefined, undefined, diaries));
    act(() => result.current.selectAll([1, 2]));
    await act(async () => {
      await result.current.executeBulkAction('rephrase', { mode: 'polish' });
    });

    expect(fixWriting).toHaveBeenCalledTimes(1);
    expect(fixWriting).toHaveBeenCalledWith('Entry 1', 'polish', 1);
    expect(fetchMock).toHaveBeenCalledWith('https://models.home.example/v1/chat/completions', expect.anything());
    expect(updateEntry).toHaveBeenCalledWith(2, expect.objectContaining({ text: 'Improved here', tags: ['focus'] }));
    expect(onComplete).toHaveBeenCalled();

    localStorage.clear();
    act(() => result.current.selectAll([2]));
    await act(async () => {
      await result.current.executeBulkAction('rephrase', { mode: 'grammar' });
    });
    expect(mockNotify).toHaveBeenLastCalledWith('This diary uses only your own model. Set up its address in Profile › AI Configuration first.');
  });
});
