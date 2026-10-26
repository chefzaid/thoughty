export interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
  clientId?: string;
}

export interface GoogleApi {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }) => void;
      prompt: (callback: (notification: {
        isNotDisplayed: () => boolean;
        isSkippedMoment: () => boolean;
      }) => void) => void;
      renderButton: (
        element: HTMLElement | null,
        config: { theme: string; size: string; width: string },
      ) => void;
    };
  };
}

/**
 * Signs in with the Google ID token (`credential`) exactly as Google issued it. The server
 * verifies it and reads the identity from it; nothing is decoded or trusted here.
 */
type GoogleCredentialLogin = (credential: string) => Promise<AuthResult>;

export function signInWithGoogleAccount(
  googleClientId: string,
  loginWithCredential: GoogleCredentialLogin,
): Promise<AuthResult> {
  return new Promise((resolve, reject) => {
    const google = (globalThis as unknown as { google?: GoogleApi }).google;
    if (!google || !googleClientId) {
      reject(new Error('googleSignInUnavailable'));
      return;
    }

    google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response) => {
        if (!response.credential) {
          reject(new Error('googleSignInFailed'));
          return;
        }
        void loginWithCredential(response.credential).then(resolve).catch(reject);
      },
    });

    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        google.accounts.id.renderButton(document.getElementById('google-signin-btn'), {
          theme: 'outline',
          size: 'large',
          width: '100%',
        });
      }
    });
  });
}
import type { AuthResult } from './authTypes';
