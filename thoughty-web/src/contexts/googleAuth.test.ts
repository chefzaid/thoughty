import { afterEach, describe, expect, it, vi } from 'vitest';
import { signInWithGoogleAccount, type GoogleApi, type GoogleCredentialResponse } from './googleAuth';

function installGoogle(credential: string | undefined): GoogleApi {
  const google: GoogleApi = {
    accounts: {
      id: {
        initialize: vi.fn(({ callback }: { callback: (response: GoogleCredentialResponse) => void }) => {
          queueMicrotask(() => callback({ credential } as GoogleCredentialResponse));
        }),
        prompt: vi.fn(),
        renderButton: vi.fn(),
      },
    },
  };
  (globalThis as unknown as { google?: GoogleApi }).google = google;
  return google;
}

describe('signInWithGoogleAccount', () => {
  afterEach(() => {
    delete (globalThis as unknown as { google?: GoogleApi }).google;
  });

  it('hands the raw Google credential to the server login without decoding it', async () => {
    // A token whose unverified payload claims another identity; the client must not read it
    const forged = `${btoa('{"alg":"RS256"}')}.${btoa('{"sub":"victim","email":"victim@example.com"}')}.sig`;
    const google = installGoogle(forged);
    const login = vi.fn().mockResolvedValue({ success: true });

    await expect(signInWithGoogleAccount('client-id', login)).resolves.toEqual({ success: true });

    expect(google.accounts.id.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'client-id' }),
    );
    expect(login).toHaveBeenCalledWith(forged);
  });

  it('rejects when Google returns no credential', async () => {
    installGoogle(undefined);
    const login = vi.fn();

    await expect(signInWithGoogleAccount('client-id', login)).rejects.toThrow(
      'googleSignInFailed',
    );
    expect(login).not.toHaveBeenCalled();
  });

  it('rejects when Google Sign-In is not configured', async () => {
    await expect(signInWithGoogleAccount('', vi.fn())).rejects.toThrow('googleSignInUnavailable');
  });
});
