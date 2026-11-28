import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { withFeatureFlags } from '../../test/featureFlags';
import { createTestQueryClient } from '../../test/queryClient';
import { useUnreadMessages } from './useMessages';

const services = { countUnread: vi.fn() };

vi.mock('../../hooks/useAuthenticatedService', () => ({
  useAuthenticatedService: () => services,
}));

function wrapperWith(flags: Parameters<typeof withFeatureFlags>[0] = {}) {
  const FlagsWrapper = withFeatureFlags(flags);
  const client = createTestQueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <FlagsWrapper>{children}</FlagsWrapper>
    </QueryClientProvider>
  );
}

describe('useUnreadMessages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('counts the unread messages, none until the API answers or when it fails', async () => {
    services.countUnread.mockResolvedValueOnce({ data: { unreadCount: 3 }, error: null });
    const { result } = renderHook(() => useUnreadMessages(), { wrapper: wrapperWith() });

    expect(result.current).toBe(0);
    await waitFor(() => expect(result.current).toBe(3));

    services.countUnread.mockResolvedValueOnce({ data: null, error: 'messagesLoadError' });
    const failed = renderHook(() => useUnreadMessages(), { wrapper: wrapperWith() });
    await waitFor(() => expect(services.countUnread).toHaveBeenCalledTimes(2));
    expect(failed.result.current).toBe(0);
  });

  it('asks nothing while public sharing is switched off', () => {
    const { result } = renderHook(() => useUnreadMessages(), { wrapper: wrapperWith({ publicSharing: false }) });

    expect(result.current).toBe(0);
    expect(services.countUnread).not.toHaveBeenCalled();
  });
});
