import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource, type FindOperator } from 'typeorm';
import { User, RefreshToken, Diary, PersonalAccessToken, Setting } from '@/database/entities';
import { AuthService } from './auth.service';
import { AuthSessionService, hashRefreshToken } from './auth-session.service';
import { IdentityVerificationService } from './identity-verification.service';
import { PasswordService } from './password.service';
import { AccountService } from './account.service';
import { EmailService } from './email.service';
import { TwoFactorService } from './two-factor.service';
import { ProviderAccountService } from './provider-account.service';
import { accountActivityProvider, createAccountActivityMock, type AccountActivityMock } from '../account-activity/account-activity.test-helpers';

/** The repository and collaborator mocks behind the auth services in their specs. */
export interface AuthServiceMocks {
  userRepository: Record<string, jest.Mock>;
  refreshTokenRepository: Record<string, jest.Mock>;
  accessTokenRepository: Record<string, jest.Mock>;
  diaryRepository: Record<string, jest.Mock>;
  jwtService: Record<string, jest.Mock>;
  emailService: Record<string, jest.Mock>;
  twoFactorService: Record<string, jest.Mock>;
  activity: AccountActivityMock;
  /** The transaction's entity manager: saves reach the user or diary repository mock (settings rows resolve as given). */
  manager: Record<string, jest.Mock>;
  dataSource: { transaction: jest.Mock };
}

export interface AuthServices {
  auth: AuthService;
  sessions: AuthSessionService;
  identity: IdentityVerificationService;
  passwords: PasswordService;
  account: AccountService;
}

/**
 * The operator type and name of a `users.exists({ where: { username } })` call (`usernameTaken`),
 * which matches the name ignoring case.
 */
export function usernameLookup(call: unknown[] | undefined): { type: string; username: unknown } {
  const operator = (call?.[0] as { where: { username: FindOperator<string> } }).where.username;
  return { type: operator.type, username: operator.objectLiteralParameters?.username };
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
  const userRepository: Record<string, jest.Mock> = {
    findOne: jest.fn(),
    save: jest.fn(),
    exists: jest.fn().mockResolvedValue(false),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    })),
  };
  const diaryRepository: Record<string, jest.Mock> = { save: jest.fn() };
  const deleteQuery = {
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
  };
  const manager: Record<string, jest.Mock> = {
    create: jest.fn((_entity: unknown, value: unknown) => value),
    save: jest.fn((entity: unknown, value: unknown) =>
      entity === Setting ? Promise.resolve(value) : (entity === Diary ? diaryRepository : userRepository).save(value),
    ),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    createQueryBuilder: jest.fn(() => deleteQuery),
  };
  return {
    manager,
    dataSource: { transaction: jest.fn((work: (m: unknown) => unknown) => work(manager)) },
    userRepository,
    diaryRepository,
    ...createCollaboratorMocks(),
  };
}

function createCollaboratorMocks() {
  return {
    refreshTokenRepository: {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    },
    accessTokenRepository: { delete: jest.fn().mockResolvedValue({ affected: 0 }) },
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
    activity: createAccountActivityMock(),
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
      ProviderAccountService,
      { provide: DataSource, useValue: mocks.dataSource },
      { provide: getRepositoryToken(User), useValue: mocks.userRepository },
      { provide: getRepositoryToken(RefreshToken), useValue: mocks.refreshTokenRepository },
      { provide: getRepositoryToken(Diary), useValue: mocks.diaryRepository },
      { provide: getRepositoryToken(PersonalAccessToken), useValue: mocks.accessTokenRepository },
      { provide: JwtService, useValue: mocks.jwtService },
      { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test-secret') } },
      { provide: EmailService, useValue: mocks.emailService },
      { provide: TwoFactorService, useValue: mocks.twoFactorService },
      accountActivityProvider(mocks.activity),
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
