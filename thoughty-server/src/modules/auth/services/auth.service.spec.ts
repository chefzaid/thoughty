import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { hashRefreshToken } from './auth-session.service';
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

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let refreshTokenRepository: any;
  let diaryRepository: any;
  let twoFactorService: any;

  beforeEach(async () => {
    const mocks = createAuthServiceMocks();
    ({ userRepository, refreshTokenRepository, diaryRepository, twoFactorService } = mocks);
    ({ auth: service } = await createAuthServices(mocks));
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

      await expectApiError(service.login({
          identifier: 'test@example.com',
          password: 'wrongpassword',
        }), UnauthorizedException, 'AUTH_INVALID_CREDENTIALS');
    });
  });
});
