export interface User {
  id: number;
  username: string;
  email: string;
  displayName?: string;
  fullName?: string;
  avatarUrl?: string;
  isNewUser?: boolean;
  authProvider?: 'local' | 'google';
  emailVerified?: boolean;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  message?: string;
  isNewUser?: boolean;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}
