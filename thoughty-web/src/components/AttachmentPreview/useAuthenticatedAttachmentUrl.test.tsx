import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthenticatedAttachmentUrl } from './useAuthenticatedAttachmentUrl';

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
});
