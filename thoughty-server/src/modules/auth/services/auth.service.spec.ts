import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { generateKeyPairSync } from 'node:crypto';
import { AuthService, hashRefreshToken } from './auth.service';
import { EmailService } from './email.service';
import { TwoFactorService } from './two-factor.service';
import { User, RefreshToken, Diary } from '@/database/entities';

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let refreshTokenRepository: any;
  let diaryRepository: any;
  let jwtService: any;
  let emailService: any;
  let twoFactorService: any;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hashed_password',
    authProvider: 'local',
    deletedAt: null,
    emailVerified: false,
    twoFactorEnabled: false,
  };

  const mockRefreshToken = {
    id: 1,
    userId: 1,
    tokenHash: hashRefreshToken('refresh_token'),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    user: mockUser,
  };

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
      })),
    };

    refreshTokenRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    diaryRepository = {
      save: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock_token'),
      verify: jest.fn(),
      verifyAsync: jest.fn(),
      decode: jest.fn(),
    };

    emailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendAccountDeletionEmail: jest.fn().mockResolvedValue(undefined),
    };
    twoFactorService = {
      startChallenge: jest.fn(),
      consumeLogin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshTokenRepository },
        { provide: getRepositoryToken(Diary), useValue: diaryRepository },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test-secret') } },
        { provide: EmailService, useValue: emailService },
        { provide: TwoFactorService, useValue: twoFactorService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.save.mockResolvedValue({ ...mockUser, id: 1 });
      diaryRepository.save.mockResolvedValue({ id: 1 });
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        username: 'testuser',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(refreshTokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, tokenHash: hashRefreshToken(result.refreshToken) }),
      );
      expect(refreshTokenRepository.save.mock.calls[0][0]).not.toHaveProperty('token');
      expect('user' in result).toBe(true);
      if ('user' in result) {
        expect(result.user.email).toBe('test@example.com');
        expect(result.user.emailVerified).toBe(false);
      }
      expect(diaryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Thoughts',
          icon: '💭',
          color: '#E76F51',
          isDefault: true,
        }),
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should generate username from email if not provided', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.save.mockImplementation((user: any) => Promise.resolve({ ...user, id: 1 }));
      diaryRepository.save.mockResolvedValue({ id: 1 });
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      await service.register({
        email: 'newuser@example.com',
        password: 'password123',
      });

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'newuser',
        }),
      );
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };
      userRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await service.login({
        identifier: 'test@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      if (!('user' in result)) {
        throw new Error('Expected a completed login response');
      }
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.emailVerified).toBe(false);
    });

    it('should require a two-factor challenge before creating a session', async () => {
      const protectedUser = { ...mockUser, twoFactorEnabled: true };
      userRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(protectedUser),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      twoFactorService.startChallenge.mockResolvedValue({
        twoFactorRequired: true,
        challengeToken: 'challenge-token',
        expiresInSeconds: 600,
      });

      const result = await service.login({
        identifier: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        twoFactorRequired: true,
        challengeToken: 'challenge-token',
        expiresInSeconds: 600,
      });
      expect(twoFactorService.startChallenge).toHaveBeenCalledWith(protectedUser, 'login');
      expect(refreshTokenRepository.save).not.toHaveBeenCalled();
    });

    it('should create a session after a valid two-factor login code', async () => {
      const protectedUser = { ...mockUser, twoFactorEnabled: true };
      twoFactorService.consumeLogin.mockResolvedValue(protectedUser);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await service.verifyTwoFactorLogin({
        challengeToken: 'challenge-token',
        code: '123456',
      });

      expect(twoFactorService.consumeLogin).toHaveBeenCalledWith({
        challengeToken: 'challenge-token',
        code: '123456',
      });
      expect(result.user.twoFactorEnabled).toBe(true);
      expect(result.accessToken).toBe('mock_token');
      expect(refreshTokenRepository.save).toHaveBeenCalledTimes(1);
    });

    const loginFailure = async (user: unknown, passwordMatches: boolean) => {
      userRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(user),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(passwordMatches);
      const error = await service
        .login({ identifier: 'test@example.com', password: 'password123' })
        .catch((caught: unknown) => caught);
      return error as UnauthorizedException;
    };

    it('should throw UnauthorizedException for non-existent user after bcrypt work', async () => {
      const error = await loginFailure(null, false);

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.message).toBe('Invalid email or password');
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password123',
        expect.stringMatching(/^\$2[aby]\$12\$/),
      );
    });

    it('answers a deleted account exactly like wrong credentials', async () => {
      const wrongPassword = await loginFailure(mockUser, false);
      (bcrypt.compare as jest.Mock).mockClear();
      const deleted = await loginFailure({ ...mockUser, deletedAt: new Date() }, true);

      expect(deleted).toBeInstanceOf(UnauthorizedException);
      expect(deleted.getStatus()).toBe(wrongPassword.getStatus());
      expect(deleted.getResponse()).toEqual(wrongPassword.getResponse());
      // bcrypt still runs, against a throwaway hash rather than the deleted account's own
      expect(bcrypt.compare).toHaveBeenCalledTimes(1);
      expect(bcrypt.compare).not.toHaveBeenCalledWith('password123', mockUser.passwordHash);
      expect(refreshTokenRepository.save).not.toHaveBeenCalled();
    });

    it('does not reveal that an account signs in with another provider', async () => {
      const error = await loginFailure(
        { ...mockUser, authProvider: 'google', passwordHash: null },
        true,
      );

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.message).toBe('Invalid email or password');
      expect(bcrypt.compare).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };
      userRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({
          identifier: 'test@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('oauthLogin', () => {
    const GOOGLE_CLIENT_ID = 'google-client-id.apps.googleusercontent.com';
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const googleJwk = { ...publicKey.export({ format: 'jwk' }), kid: 'google-key', use: 'sig' };

    const googleCredential = (
      claims: Record<string, unknown> = {},
      options: { audience?: string; issuer?: string; expiresIn?: number; key?: string } = {},
    ) =>
      new JwtService().sign(
        {
          sub: 'google-sub-123',
          email: 'Test@Example.com',
          email_verified: true,
          name: 'New User',
          picture: 'https://lh3.googleusercontent.com/avatar',
          ...claims,
        },
        {
          privateKey: options.key ?? privateKey.export({ format: 'pem', type: 'pkcs8' }),
          algorithm: 'RS256',
          keyid: 'google-key',
          issuer: options.issuer ?? 'https://accounts.google.com',
          audience: options.audience ?? GOOGLE_CLIENT_ID,
          expiresIn: options.expiresIn ?? 300,
        },
      );

    const oauth = (credential: string) => service.oauthLogin({ provider: 'google', credential });

    beforeEach(() => {
      // A real JwtService with an unrelated HMAC secret, as in the running app
      (service as any).jwtService = new JwtService({ secret: 'application-hmac-secret' });
      (service as any).googleClientId = GOOGLE_CLIENT_ID;
      jest.spyOn((service as any).googleKeys, 'getSigningKey').mockResolvedValue(googleJwk);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);
    });

    it('logs in the user linked to the verified Google subject', async () => {
      userRepository.findOne.mockResolvedValue({ ...mockUser, authProvider: 'google' });

      const result = await oauth(googleCredential());

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { authProvider: 'google', providerId: 'google-sub-123' },
      });
      expect(result.accessToken).toBeTruthy();
      expect(result.user.authProvider).toBe('google');
    });

    it('accepts the bare accounts.google.com issuer', async () => {
      userRepository.findOne.mockResolvedValue({ ...mockUser, authProvider: 'google' });

      await expect(
        oauth(googleCredential({}, { issuer: 'accounts.google.com' })),
      ).resolves.toHaveProperty('accessToken');
    });

    it('should throw ForbiddenException for deleted OAuth user', async () => {
      userRepository.findOne.mockResolvedValue({ ...mockUser, deletedAt: new Date() });

      await expect(oauth(googleCredential())).rejects.toThrow(ForbiddenException);
    });

    it('links a verified Google identity to the account with that email', async () => {
      const existingUser = { ...mockUser };
      userRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existingUser);
      userRepository.save.mockImplementation((user: any) => Promise.resolve(user));

      const result = await oauth(googleCredential());

      expect(userRepository.findOne).toHaveBeenLastCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          authProvider: 'google',
          providerId: 'google-sub-123',
          avatarUrl: 'https://lh3.googleusercontent.com/avatar',
          emailVerified: true,
        }),
      );
      expect(result.user.emailVerified).toBe(true);
    });

    it('creates a new user from the verified claims only', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.save.mockImplementation((user: any) =>
        Promise.resolve({ ...user, id: 1, deletedAt: null, twoFactorEnabled: false }),
      );
      diaryRepository.save.mockResolvedValue({ id: 1 });

      const result = await oauth(googleCredential());

      expect(result.user.isNewUser).toBe(true);
      expect(result.user.emailVerified).toBe(true);
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'New User',
          email: 'test@example.com',
          providerId: 'google-sub-123',
          avatarUrl: 'https://lh3.googleusercontent.com/avatar',
        }),
      );
      expect(diaryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          color: '#E76F51',
        }),
      );
    });

    it.each([
      ['an unverified email', googleCredential({ email_verified: false })],
      ['a missing email_verified claim', googleCredential({ email_verified: undefined })],
      ['a string email_verified claim', googleCredential({ email_verified: 'true' })],
      ['a missing email', googleCredential({ email: undefined })],
    ])('refuses a credential with %s', async (_case, credential) => {
      await expect(oauth(credential)).rejects.toThrow(UnauthorizedException);
      expect(userRepository.findOne).not.toHaveBeenCalled();
      expect(refreshTokenRepository.save).not.toHaveBeenCalled();
    });

    it.each([
      ['another audience', () => googleCredential({}, { audience: 'other-client-id' })],
      ['another issuer', () => googleCredential({}, { issuer: 'https://evil.example' })],
      ['an expired token', () => googleCredential({}, { expiresIn: -60 })],
      [
        'a signature from another key',
        () =>
          googleCredential(
            {},
            {
              key: generateKeyPairSync('rsa', { modulusLength: 2048 })
                .privateKey.export({ format: 'pem', type: 'pkcs8' })
                .toString(),
            },
          ),
      ],
      [
        'a client-forged unsigned token',
        () =>
          [
            Buffer.from(JSON.stringify({ alg: 'none', kid: 'google-key' })).toString('base64url'),
            Buffer.from(
              JSON.stringify({ sub: 'victim', email: 'test@example.com', email_verified: true }),
            ).toString('base64url'),
            '',
          ].join('.'),
      ],
      ['a malformed token', () => 'not-a-jwt'],
    ])('rejects %s', async (_case, credential) => {
      await expect(oauth(credential())).rejects.toThrow('Invalid Google credential');
      expect(userRepository.findOne).not.toHaveBeenCalled();
      expect(refreshTokenRepository.save).not.toHaveBeenCalled();
    });

    it('refuses Google sign-in when no Google client ID is configured', async () => {
      (service as any).googleClientId = '';

      await expect(oauth(googleCredential())).rejects.toThrow(ServiceUnavailableException);
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('keycloakLogin', () => {
    const signingKey = () => {
      const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
      return { ...publicKey.export({ format: 'jwk' }), kid: 'key-1', use: 'sig' };
    };

    const mockVerifiedIdentity = (claims: Record<string, unknown> = {}) => {
      jwtService.decode.mockReturnValue({ header: { kid: 'key-1' } });
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'keycloak-user-id',
        email: 'test@example.com',
        email_verified: true,
        preferred_username: 'testuser',
        ...claims,
      });
      jest.spyOn((service as any).keycloakKeys, 'getSigningKey').mockResolvedValue(signingKey());
    };

    it('verifies and links a Keycloak identity before creating a local session', async () => {
      mockVerifiedIdentity();
      userRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...mockUser });
      userRepository.save.mockImplementation((user: any) => Promise.resolve(user));
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await service.keycloakLogin('signed-keycloak-token');

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        'signed-keycloak-token',
        expect.objectContaining({
          algorithms: ['RS256'],
          audience: 'test-secret',
          issuer: 'test-secret',
          secret: expect.stringContaining('BEGIN PUBLIC KEY'),
        }),
      );
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          authProvider: 'keycloak',
          providerId: 'keycloak-user-id',
          emailVerified: true,
        }),
      );
      expect(result.accessToken).toBe('mock_token');
    });

    it('overrides the application HMAC secret when verifying a real RS256 token', async () => {
      const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
      const token = new JwtService().sign(
        {
          sub: 'keycloak-user-id',
          email: 'test@example.com',
          email_verified: true,
          preferred_username: 'testuser',
        },
        {
          privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }),
          algorithm: 'RS256',
          keyid: 'key-1',
          issuer: 'test-secret',
          audience: 'test-secret',
          expiresIn: '5m',
        },
      );
      (service as any).jwtService = new JwtService({ secret: 'application-hmac-secret' });
      jest.spyOn((service as any).keycloakKeys, 'getSigningKey').mockResolvedValue({
        ...publicKey.export({ format: 'jwk' }),
        kid: 'key-1',
        use: 'sig',
      });
      userRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...mockUser });
      userRepository.save.mockImplementation((user: any) => Promise.resolve(user));
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await service.keycloakLogin(token);

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBeTruthy();
    });

    it('rejects an SSO exchange without an ingress access token', async () => {
      await expect(service.keycloakLogin()).rejects.toThrow(UnauthorizedException);
    });

    it('creates a local profile and default diary for a new Keycloak identity', async () => {
      mockVerifiedIdentity({ email: 'ZAID@swirlit.dev', preferred_username: 'z'.repeat(60) });
      userRepository.findOne.mockResolvedValue(null);
      userRepository.save.mockImplementation((user: any) =>
        Promise.resolve({ ...user, id: 7, deletedAt: null, twoFactorEnabled: false }),
      );
      diaryRepository.save.mockResolvedValue({ id: 4 });
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await service.keycloakLogin('signed-keycloak-token');

      expect(result.user.isNewUser).toBe(true);
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'zaid@swirlit.dev',
          username: 'z'.repeat(50),
          authProvider: 'keycloak',
        }),
      );
      expect(diaryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 7, name: 'Thoughts', isDefault: true }),
      );
    });

    it('rejects a Keycloak identity with incomplete verified claims', async () => {
      mockVerifiedIdentity({ email_verified: false });

      await expect(service.keycloakLogin('signed-keycloak-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a deleted account linked by Keycloak subject', async () => {
      mockVerifiedIdentity();
      userRepository.findOne.mockResolvedValue({ ...mockUser, deletedAt: new Date() });

      await expect(service.keycloakLogin('signed-keycloak-token')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects tokens without a key id or with a failed signature', async () => {
      jwtService.decode.mockReturnValueOnce({ header: {} });
      await expect(service.keycloakLogin('unsigned-token')).rejects.toThrow(
        'Keycloak access token has no signing key',
      );

      mockVerifiedIdentity();
      jwtService.verifyAsync.mockRejectedValueOnce(new Error('bad signature'));
      await expect(service.keycloakLogin('bad-token')).rejects.toThrow(
        'Invalid Keycloak access token',
      );
    });

    it('uses cached keys and refreshes after key rotation', async () => {
      const cachedKey = { kid: 'cached', use: 'sig', kty: 'RSA' };
      const rotatedKey = { kid: 'rotated', use: 'sig', kty: 'RSA' };
      const keycloakKeys = (service as any).keycloakKeys;
      keycloakKeys.cache = {
        expiresAt: Date.now() + 60_000,
        keys: [cachedKey],
      };
      await expect(keycloakKeys.getSigningKey('cached')).resolves.toBe(cachedKey);

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ keys: [rotatedKey] }),
      } as Response);
      await expect(keycloakKeys.getSigningKey('rotated')).resolves.toEqual(rotatedKey);
    });

    it('rejects failed, empty, and keyless JWKS responses', async () => {
      const keycloakKeys = (service as any).keycloakKeys;
      const fetchSpy = jest.spyOn(global, 'fetch');
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 503 } as Response);
      await expect(keycloakKeys.refresh()).rejects.toThrow('Keycloak JWKS request failed with 503');

      fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ keys: [] }) } as Response);
      await expect(keycloakKeys.refresh()).rejects.toThrow('Keycloak JWKS response has no keys');

      fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ keys: [] }) } as Response);
      keycloakKeys.cache = null;
      await expect(keycloakKeys.getSigningKey('missing')).rejects.toThrow();
    });
  });

  describe('refreshToken', () => {
    const claimRows = (rows: Array<{ user_id: number }>) => {
      const builder = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ raw: rows, affected: rows.length }),
      };
      refreshTokenRepository.createQueryBuilder.mockReturnValue(builder);
      return builder;
    };

    it('rotates the refresh token: deletes the presented one and issues a new pair', async () => {
      jwtService.verify.mockReturnValue({ userId: 1 });
      jwtService.sign.mockReturnValueOnce('new_access').mockReturnValueOnce('new_refresh');
      const builder = claimRows([{ user_id: 1 }]);
      userRepository.findOne.mockResolvedValue(mockUser);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await service.refreshToken('valid_refresh_token');

      expect(result).toEqual({ accessToken: 'new_access', refreshToken: 'new_refresh' });
      expect(builder.where).toHaveBeenCalledWith('token_hash = :tokenHash', {
        tokenHash: hashRefreshToken('valid_refresh_token'),
      });
      expect(builder.returning).toHaveBeenCalledWith('user_id');
      expect(refreshTokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, tokenHash: hashRefreshToken('new_refresh') }),
      );
      expect(jwtService.sign).toHaveBeenLastCalledWith(
        { userId: 1, jti: expect.any(String) },
        expect.objectContaining({ expiresIn: '7d' }),
      );
    });

    it('rejects a refresh token that was already used', async () => {
      jwtService.verify.mockReturnValue({ userId: 1 });
      claimRows([{ user_id: 1 }]);
      userRepository.findOne.mockResolvedValue(mockUser);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);
      await service.refreshToken('valid_refresh_token');

      claimRows([]);
      await expect(service.refreshToken('valid_refresh_token')).rejects.toThrow(
        'Refresh token expired or revoked',
      );
      expect(refreshTokenRepository.save).toHaveBeenCalledTimes(1);
    });

    it('rejects a missing refresh token', async () => {
      await expect(service.refreshToken(undefined)).rejects.toThrow(UnauthorizedException);
      expect(refreshTokenRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken('invalid_token')).rejects.toThrow(UnauthorizedException);
      expect(refreshTokenRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for expired/revoked token', async () => {
      jwtService.verify.mockReturnValue({ userId: 1 });
      claimRows([]);

      await expect(service.refreshToken('expired_token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException for deleted user token', async () => {
      jwtService.verify.mockReturnValue({ userId: 1 });
      claimRows([{ user_id: 1 }]);
      userRepository.findOne.mockResolvedValue({ ...mockUser, deletedAt: new Date() });

      await expect(service.refreshToken('valid_token')).rejects.toThrow(ForbiddenException);
      expect(refreshTokenRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should logout successfully with refresh token', async () => {
      refreshTokenRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.logout('refresh_token');

      expect(result).toEqual({ success: true });
      expect(refreshTokenRepository.delete).toHaveBeenCalledWith({
        tokenHash: hashRefreshToken('refresh_token'),
      });
    });

    it('should logout successfully without refresh token', async () => {
      const result = await service.logout();

      expect(result).toEqual({ success: true });
      expect(refreshTokenRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    it('should return user data', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getMe(1);

      expect(result.id).toBe(1);
      expect(result.email).toBe('test@example.com');
      expect(result.emailVerified).toBe(false);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getMe(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      userRepository.save.mockResolvedValue(mockUser);
      refreshTokenRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.changePassword(1, {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword',
      });

      expect(result.success).toBe(true);
      expect(refreshTokenRepository.delete).toHaveBeenCalledWith({ userId: 1 });
    });

    it('should throw NotFoundException for non-existent user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword(999, {
          currentPassword: 'oldpassword',
          newPassword: 'newpassword',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for OAuth user without password', async () => {
      userRepository.findOne.mockResolvedValue({ ...mockUser, passwordHash: null });

      await expect(
        service.changePassword(1, {
          currentPassword: 'oldpassword',
          newPassword: 'newpassword',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException for incorrect current password', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(1, {
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('should send reset email for local user', async () => {
      const localUser = { ...mockUser, authProvider: 'local' };
      userRepository.findOne.mockResolvedValue(localUser);
      userRepository.save.mockResolvedValue(localUser);

      const result = await service.forgotPassword('test@example.com');

      expect(result.success).toBe(true);
      // Verify reset token was saved
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          resetToken: expect.any(String),
          resetTokenExpires: expect.any(Date),
        }),
      );
    });

    it('should return success for non-existent email (prevent enumeration)', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword('nonexistent@example.com');

      expect(result.success).toBe(true);
    });

    it('does not send a reset link for a deleted account', async () => {
      userRepository.findOne.mockResolvedValue({ ...mockUser, deletedAt: new Date() });

      const result = await service.forgotPassword('test@example.com');

      expect(result).toEqual({
        success: true,
        message: 'If an account exists with this email, a reset link will be sent.',
      });
      expect(userRepository.save).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('answers before the mail server does, like for an unknown address', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      emailService.sendPasswordResetEmail.mockReturnValue(new Promise(() => undefined));

      const result = await service.forgotPassword('test@example.com');

      expect(result.success).toBe(true);
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('/reset-password?token='),
      );
    });

    it('should return success for OAuth user without sending email', async () => {
      userRepository.findOne.mockResolvedValue({ ...mockUser, authProvider: 'google' });

      const result = await service.forgotPassword('test@example.com');

      expect(result.success).toBe(true);
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should handle email service failure gracefully', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      emailService.sendPasswordResetEmail.mockRejectedValue(new Error('SMTP error'));

      const result = await service.forgotPassword('test@example.com');

      expect(result.success).toBe(true);
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        resetToken: 'hashed_token',
        resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000),
      });
      userRepository.save.mockResolvedValue(mockUser);
      refreshTokenRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.resetPassword('valid_token', 'newpassword');

      expect(result.success).toBe(true);
      expect(refreshTokenRepository.delete).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid token', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.resetPassword('invalid_token', 'newpassword')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteAccount', () => {
    it('should delete local account with valid password', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      userRepository.save.mockResolvedValue({ ...mockUser, deletedAt: new Date() });
      refreshTokenRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteAccount(1, 'password123');

      expect(result.success).toBe(true);
      expect(emailService.sendAccountDeletionEmail).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteAccount(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for local account without password', async () => {
      userRepository.findOne.mockResolvedValue({ ...mockUser, authProvider: 'local' });
      (bcrypt.compare as jest.Mock).mockClear();

      await expect(service.deleteAccount(1)).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      userRepository.findOne.mockResolvedValue({ ...mockUser, authProvider: 'local' });
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(service.deleteAccount(1, 'wrongpassword')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should delete OAuth account without password', async () => {
      userRepository.findOne.mockResolvedValue({ ...mockUser, authProvider: 'google' });
      userRepository.save.mockResolvedValue({ ...mockUser, deletedAt: new Date() });
      refreshTokenRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteAccount(1);

      expect(result.success).toBe(true);
    });

    it('should handle email service failure gracefully', async () => {
      userRepository.findOne.mockResolvedValue({ ...mockUser, authProvider: 'google' });
      userRepository.save.mockResolvedValue({ ...mockUser, deletedAt: new Date() });
      refreshTokenRepository.delete.mockResolvedValue({ affected: 1 });
      emailService.sendAccountDeletionEmail.mockRejectedValue(new Error('SMTP error'));
      jest.spyOn(console, 'log').mockImplementation(() => undefined);

      const result = await service.deleteAccount(1);

      expect(result.success).toBe(true);
    });
  });
});
