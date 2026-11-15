import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestQueryClient } from '../../test/queryClient';
import { FEATURE_FLAG_DEFAULTS, useFeatureFlag, type FeatureName } from './featureFlags';
import { FEATURE_FLAGS_QUERY_KEY, FEATURE_FLAGS_STALE_TIME_MS, FeatureFlagsProvider } from './FeatureFlagsProvider';

const auth = vi.hoisted(() => ({ isAuthenticated: true }));
const fetchFeatureFlags = vi.hoisted(() => vi.fn());

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../hooks/useApiServices', () => ({ useApiServices: () => ({ configService: { fetchFeatureFlags } }) }));

function Flags() {
  const flags: Record<FeatureName, boolean> = {
    ai: useFeatureFlag('ai'),
    bookConverter: useFeatureFlag('bookConverter'),
    cloudSync: useFeatureFlag('cloudSync'),
    publicSharing: useFeatureFlag('publicSharing'),
  };
  return <p data-testid="flags">{Object.entries(flags).map(([name, on]) => `${name}=${String(on)}`).join(' ')}</p>;
}

function renderProvider(queryClient = createTestQueryClient()) {
  render(
    <QueryClientProvider client={queryClient}>
      <FeatureFlagsProvider>
        <Flags />
      </FeatureFlagsProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

const ALL_ON = 'ai=true bookConverter=true cloudSync=true publicSharing=true';

describe('FeatureFlagsProvider', () => {
  beforeEach(() => {
    auth.isAuthenticated = true;
    fetchFeatureFlags.mockReset();
  });

  it('treats every feature as on outside the provider, as the API documents for a missing flag', () => {
    render(<Flags />);
    expect(screen.getByTestId('flags')).toHaveTextContent(ALL_ON);
    expect(Object.values(FEATURE_FLAG_DEFAULTS).every(Boolean)).toBe(true);
  });

  it('keeps every feature on while the flags load, then switches off the ones the API turned off', async () => {
    let answer!: (flags: Record<string, boolean>) => void;
    fetchFeatureFlags.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    renderProvider();

    expect(screen.getByTestId('flags')).toHaveTextContent(ALL_ON);
    await act(async () => answer({ ai: false, publicSharing: false, newEditor: true }));

    await waitFor(() => expect(screen.getByTestId('flags')).toHaveTextContent('ai=false bookConverter=true cloudSync=true publicSharing=false'));
  });

  it('falls back to the defaults when the flags cannot be read', async () => {
    fetchFeatureFlags.mockResolvedValue(null);
    renderProvider();

    await waitFor(() => expect(fetchFeatureFlags).toHaveBeenCalled());
    expect(screen.getByTestId('flags')).toHaveTextContent(ALL_ON);
  });

  it('keeps the flags last read when a later read fails', async () => {
    fetchFeatureFlags.mockResolvedValueOnce({ cloudSync: false }).mockResolvedValue(null);
    const queryClient = renderProvider();
    await waitFor(() => expect(screen.getByTestId('flags')).toHaveTextContent('cloudSync=false'));

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: FEATURE_FLAGS_QUERY_KEY });
    });

    expect(fetchFeatureFlags).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('flags')).toHaveTextContent('cloudSync=false');
  });

  it('asks again when the window regains focus after the flags went stale, and not before signing in', async () => {
    auth.isAuthenticated = false;
    fetchFeatureFlags.mockResolvedValue({});
    renderProvider();
    expect(fetchFeatureFlags).not.toHaveBeenCalled();

    const queryClient = createTestQueryClient();
    auth.isAuthenticated = true;
    renderProvider(queryClient);
    await waitFor(() => expect(fetchFeatureFlags).toHaveBeenCalledTimes(1));
    const query = queryClient.getQueryCache().find({ queryKey: FEATURE_FLAGS_QUERY_KEY });
    expect(query?.options).toMatchObject({ staleTime: FEATURE_FLAGS_STALE_TIME_MS, refetchOnWindowFocus: true });
  });
});
