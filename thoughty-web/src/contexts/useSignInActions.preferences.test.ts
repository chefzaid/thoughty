import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { GoogleApi, GoogleCredentialResponse } from './googleAuth';
import { json, routeFetch } from './AuthContext.test-helpers';
import { useSignInActions } from './useSignInActions';

function renderActions() {
  const startSession = vi.fn();
  const { result } = renderHook(() =>
    useSignInActions({ googleClientId: 'client-id', setError: vi.fn(), startSession }),
  );
  return { actions: () => result.current, startSession };
}

const bodyOf = (fetchMock: ReturnType<typeof routeFetch>, url: string) =>
  JSON.parse(String((fetchMock.mock.calls.find(([called]) => called === url)?.[1] as RequestInit).body)) as unknown;

describe('useSignInActions sends the visitor’s language and theme', () => {
  afterEach(() => {
    delete (globalThis as unknown as { google?: GoogleApi }).google;
    vi.restoreAllMocks();
  });

  it('with registration, and nothing more when none are given', async () => {
    const fetchMock = routeFetch({
      '/api/auth/register': [json({ verificationRequired: true, message: 'Check your email' }, 202)],
    });
    const { actions } = renderActions();

    await act(async () => {
      await actions().register('new@example.com', 'Pass123!@', 'newbie', '', { language: 'fr', theme: 'light' });
    });
    expect(bodyOf(fetchMock, '/api/auth/register')).toEqual({
      email: 'new@example.com',
      password: 'Pass123!@',
      username: 'newbie',
      website: '',
      language: 'fr',
      theme: 'light',
    });

    fetchMock.mockClear();
    await act(async () => {
      await actions().register('new@example.com', 'Pass123!@', 'newbie');
    });
    expect(bodyOf(fetchMock, '/api/auth/register')).toEqual({
      email: 'new@example.com',
      password: 'Pass123!@',
      username: 'newbie',
      website: '',
    });
  });

  it('with the Google credential', async () => {
    (globalThis as unknown as { google?: GoogleApi }).google = {
      accounts: {
        id: {
          initialize: ({ callback }: { callback: (response: GoogleCredentialResponse) => void }) => {
            queueMicrotask(() => callback({ credential: 'google-id-token' }));
          },
          prompt: vi.fn(),
          renderButton: vi.fn(),
        },
      },
    };
    const fetchMock = routeFetch({
      '/api/auth/oauth': [json({ accessToken: 'access', user: { id: 9, email: 'g@example.com', isNewUser: true } })],
    });
    const { actions, startSession } = renderActions();

    let result: unknown;
    await act(async () => {
      result = await actions().signInWithGoogle({ language: 'fr', theme: 'dark' });
    });

    expect(result).toEqual({ success: true, isNewUser: true });
    expect(startSession).toHaveBeenCalled();
    expect(bodyOf(fetchMock, '/api/auth/oauth')).toEqual({
      provider: 'google',
      credential: 'google-id-token',
      language: 'fr',
      theme: 'dark',
    });
  });
});
