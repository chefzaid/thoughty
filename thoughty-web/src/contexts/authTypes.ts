import type { components } from '../generated/openapi';

type Schemas = components['schemas'];

/**
 * The signed-in user: what a new session reports, plus the avatar `GET /api/auth/me` adds.
 * Derived from the API contract so a renamed field fails the type check.
 */
export type User = Schemas['AuthUserDto'] & Partial<Pick<Schemas['UserResponseDto'], 'avatarUrl'>>;

export interface AuthResult {
  success: boolean;
  error?: string;
  message?: string;
  isNewUser?: boolean;
  twoFactorRequired?: boolean;
  challengeToken?: string;
  expiresInSeconds?: number;
  /** Registration created no account yet: the address was emailed a link to finish. */
  verificationRequired?: boolean;
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

/** Where the server can send email, registration only emails a link that creates the account. */
export type SignUpStartedResponse = Schemas['SignUpStartedResponseDto'];

export type RegisterResponse = TokenResponse | SignUpStartedResponse;

export type CompleteSignUpRequest = Schemas['CompleteSignUpDto'];
