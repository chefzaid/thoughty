import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User, RefreshToken, Diary } from '@/database/entities';
import { AuthService } from './auth.service';
import { AuthSessionService, hashRefreshToken } from './auth-session.service';
import { IdentityVerificationService } from './identity-verification.service';
import { PasswordService } from './password.service';
import { AccountService } from './account.service';
import { EmailService } from './email.service';
import { TwoFactorService } from './two-factor.service';

/** The repository and collaborator mocks behind the auth services in their specs. */
export interface AuthServiceMocks {
  userRepository: Record<string, jest.Mock>;
  refreshTokenRepository: Record<string, jest.Mock>;
  diaryRepository: Record<string, jest.Mock>;
  jwtService: Record<string, jest.Mock>;
  emailService: Record<string, jest.Mock>;
  twoFactorService: Record<string, jest.Mock>;
}

export interface AuthServices {
  auth: AuthService;
  sessions: AuthSessionService;
  identity: IdentityVerificationService;
  passwords: PasswordService;
  account: AccountService;
}

export const mockUser = {
  id: 1,
  email: 'test@example.com',
  username: 'testuser',
  passwordHash: 'hashed_password',
  authProvider: 'local',
  deletedAt: null,
  emailVerified: false,
  twoFactorEnabled: false,
};

export const mockRefreshToken = {
  id: 1,
  userId: 1,
  tokenHash: hashRefreshToken('refresh_token'),
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  user: mockUser,
};

export function createAuthServiceMocks(): AuthServiceMocks {
  return {
    userRepository: {
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
      })),
    },
    refreshTokenRepository: {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    },
    diaryRepository: {
      save: jest.fn(),
    },
    jwtService: {
      sign: jest.fn().mockReturnValue('mock_token'),
      verify: jest.fn(),
      verifyAsync: jest.fn(),
      decode: jest.fn(),
    },
    emailService: {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendAccountDeletionEmail: jest.fn().mockResolvedValue(undefined),
    },
    twoFactorService: {
      startChallenge: jest.fn(),
      consumeLogin: jest.fn(),
    },
  };
}

/**
 * The auth services as the auth module wires them, over the given mocks. Every configuration value
 * reads as `test-secret`.
 */
export async function createAuthServices(mocks: AuthServiceMocks): Promise<AuthServices> {
  const module = await Test.createTestingModule({
    providers: [
      AuthService,
      AuthSessionService,
      IdentityVerificationService,
      PasswordService,
      AccountService,
      { provide: getRepositoryToken(User), useValue: mocks.userRepository },
      { provide: getRepositoryToken(RefreshToken), useValue: mocks.refreshTokenRepository },
      { provide: getRepositoryToken(Diary), useValue: mocks.diaryRepository },
      { provide: JwtService, useValue: mocks.jwtService },
      { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test-secret') } },
      { provide: EmailService, useValue: mocks.emailService },
      { provide: TwoFactorService, useValue: mocks.twoFactorService },
    ],
  }).compile();

  return {
    auth: module.get(AuthService),
    sessions: module.get(AuthSessionService),
    identity: module.get(IdentityVerificationService),
    passwords: module.get(PasswordService),
    account: module.get(AccountService),
  };
}
