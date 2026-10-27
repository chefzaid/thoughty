import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthenticatedAttachmentResource, useAuthenticatedAttachmentUrl } from './useAuthenticatedAttachmentUrl';

const authFetch = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ authFetch }),
}));

describe('useAuthenticatedAttachmentUrl', () => {
  const createObjectURL = vi.fn(() => 'blob:authenticated-file');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads a protected attachment and revokes its object URL', async () => {
    const blob = new Blob(['file']);
    authFetch.mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(blob),
    });

    const { result, unmount } = renderHook(() => useAuthenticatedAttachmentUrl('stored.pdf'));

    await waitFor(() => expect(result.current).toBe('blob:authenticated-file'));
    expect(authFetch).toHaveBeenCalledWith('/api/attachments/file/stored.pdf');
    expect(createObjectURL).toHaveBeenCalledWith(blob);

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:authenticated-file');
  });

  it('keeps the URL empty when the request fails', async () => {
    authFetch.mockResolvedValue({ ok: false });

    const { result } = renderHook(() => useAuthenticatedAttachmentUrl('missing.pdf'));

    await waitFor(() => expect(authFetch).toHaveBeenCalled());
    expect(result.current).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('says where the fetch stands, and fetches again on a new attempt', async () => {
    authFetch.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ok: true, blob: vi.fn().mockResolvedValue(new Blob(['v'])) });

    const { result, rerender } = renderHook(({ key, attempt }) => useAuthenticatedAttachmentResource(key, attempt), {
      initialProps: { key: null as string | null, attempt: 0 },
    });
    expect(result.current).toEqual({ url: null, status: 'idle' });

    rerender({ key: 'clip.mp4', attempt: 0 });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current).toEqual({ url: null, status: 'failed' }));

    rerender({ key: 'clip.mp4', attempt: 1 });
    await waitFor(() => expect(result.current).toEqual({ url: 'blob:authenticated-file', status: 'ready' }));
    expect(authFetch).toHaveBeenCalledTimes(2);
  });
});
