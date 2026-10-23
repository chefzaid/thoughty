export interface User {
  id: number;
  username: string;
  email: string;
  displayName?: string;
  fullName?: string;
  avatarUrl?: string;
  isNewUser?: boolean;
  authProvider?: 'local' | 'google' | 'keycloak';
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  message?: string;
  isNewUser?: boolean;
  twoFactorRequired?: boolean;
  challengeToken?: string;
  expiresInSeconds?: number;
}

/** A new session. The refresh token never reaches the page: it is an httpOnly cookie. */
export interface TokenResponse {
  accessToken: string;
  user: User;
}

export interface TwoFactorChallengeResponse {
  twoFactorRequired: true;
  challengeToken: string;
  expiresInSeconds: number;
}

export type LoginResponse = TokenResponse | TwoFactorChallengeResponse;
