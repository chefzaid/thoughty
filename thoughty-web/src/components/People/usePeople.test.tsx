import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '../../test/queryClient';
import { usePeople, usePeopleList } from './usePeople';

const service = vi.hoisted(() => ({ list: vi.fn(), rename: vi.fn(), merge: vi.fn(), remove: vi.fn() }));
vi.mock('../../hooks/useAuthenticatedService', () => ({ useAuthenticatedService: () => service }));

const marie = { id: 12, name: 'Marie', handles: ['marie'], entryCount: 2, lastMentionedOn: null, createdAt: '', updatedAt: '' };

function setup() {
  const client = createTestQueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { invalidate, wrapper };
}

const invalidatedKeys = (invalidate: ReturnType<typeof setup>['invalidate']) =>
  invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown }).queryKey);

describe('usePeople', () => {
  it('loads the people once for every screen, and reports a failed load', async () => {
    service.list.mockResolvedValueOnce({ data: { people: [marie], limit: 1000 }, error: null });
    const { wrapper } = setup();
    const { result } = renderHook(() => usePeopleList(), { wrapper });
    await waitFor(() => expect(result.current.people).toEqual([marie]));

    service.list.mockResolvedValueOnce({ data: null, error: 'peopleLoadFailed' });
    const failed = renderHook(() => usePeopleList(), { wrapper: setup().wrapper });
    await waitFor(() => expect(failed.result.current.list.isError).toBe(true));
    expect(failed.result.current.people).toEqual([]);
  });

  it('reloads the people after a rename, and the journal and saved searches after a merge or delete', async () => {
    service.list.mockResolvedValue({ data: { people: [marie], limit: 1000 }, error: null });
    service.rename.mockResolvedValue({ data: marie, error: null });
    service.merge.mockResolvedValueOnce({ data: marie, error: null }).mockResolvedValueOnce({ data: null, error: 'personMergeFailed' });
    service.remove.mockResolvedValue({ data: { success: true }, error: null });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => usePeople(), { wrapper });

    await act(async () => { await result.current.rename(12, 'Marie Curie'); });
    expect(service.rename).toHaveBeenCalledWith(12, 'Marie Curie');
    expect(invalidatedKeys(invalidate)).toEqual([['app', 'people']]);

    invalidate.mockClear();
    await act(async () => { await result.current.merge(12, 14); });
    expect(invalidatedKeys(invalidate)).toEqual(expect.arrayContaining([['savedSearches'], ['app', 'entries'], ['app', 'people']]));

    invalidate.mockClear();
    await act(async () => { await result.current.merge(12, 15); });
    expect(invalidatedKeys(invalidate)).toEqual([['app', 'people']]);

    invalidate.mockClear();
    await act(async () => { await result.current.remove(12); });
    expect(service.remove).toHaveBeenCalledWith(12);
    expect(invalidatedKeys(invalidate)).toEqual(expect.arrayContaining([['savedSearches'], ['app', 'people']]));
  });
});
