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

export interface GoogleCredentialPayload {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

export function parseGoogleCredentialPayload(credential: string): GoogleCredentialPayload {
  const payloadPart = credential.split('.')[1];
  if (!payloadPart) {
    throw new Error('Invalid JWT format');
  }

  return JSON.parse(atob(payloadPart)) as GoogleCredentialPayload;
}

type OAuthLogin = (
  provider: string,
  providerId: string,
  email: string,
  name: string,
  avatarUrl: string,
) => Promise<AuthResult>;

export function signInWithGoogleAccount(
  googleClientId: string,
  oauthLogin: OAuthLogin,
): Promise<AuthResult> {
  return new Promise((resolve, reject) => {
    const google = (globalThis as unknown as { google?: GoogleApi }).google;
    if (!google || !googleClientId) {
      reject(new Error('Google Sign-In not configured'));
      return;
    }

    google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response) => {
        let payload: GoogleCredentialPayload;
        try {
          payload = parseGoogleCredentialPayload(response.credential);
        } catch (error) {
          reject(error);
          return;
        }
        void oauthLogin('google', payload.sub, payload.email, payload.name, payload.picture)
          .then(resolve)
          .catch(reject);
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
