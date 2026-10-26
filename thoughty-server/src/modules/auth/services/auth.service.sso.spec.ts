import {
  UnauthorizedException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { generateKeyPairSync } from 'node:crypto';
import { AuthService } from './auth.service';
import type { AuthSessionService } from './auth-session.service';
import type { IdentityVerificationService } from './identity-verification.service';
import {
  createAuthServiceMocks,
  createAuthServices,
  mockRefreshToken,
  mockUser,
} from './auth-services.test-helpers';

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

describe('AuthService Google and Keycloak sign-in', () => {
  let service: AuthService;
  let sessions: AuthSessionService;
  let identity: IdentityVerificationService;
  let userRepository: any;
  let refreshTokenRepository: any;
  let diaryRepository: any;
  let jwtService: any;

  beforeEach(async () => {
    const mocks = createAuthServiceMocks();
    ({ userRepository, refreshTokenRepository, diaryRepository, jwtService } = mocks);
    ({ auth: service, sessions, identity } = await createAuthServices(mocks));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  /** A real JwtService with an unrelated HMAC secret, as in the running app, for verifying and signing. */
  const useApplicationJwtService = () => {
    const applicationJwtService = new JwtService({ secret: 'application-hmac-secret' });
    (identity as any).jwtService = applicationJwtService;
    (sessions as any).jwtService = applicationJwtService;
  };

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
      useApplicationJwtService();
      (identity as any).googleClientId = GOOGLE_CLIENT_ID;
      jest.spyOn((identity as any).googleKeys, 'getSigningKey').mockResolvedValue(googleJwk);
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
      (identity as any).googleClientId = '';

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
      jest.spyOn((identity as any).keycloakKeys, 'getSigningKey').mockResolvedValue(signingKey());
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
      useApplicationJwtService();
      jest.spyOn((identity as any).keycloakKeys, 'getSigningKey').mockResolvedValue({
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
      const keycloakKeys = (identity as any).keycloakKeys;
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
      const keycloakKeys = (identity as any).keycloakKeys;
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
});
