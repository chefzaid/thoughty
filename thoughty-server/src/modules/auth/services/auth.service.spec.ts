import { UnauthorizedException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
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
  let twoFactorService: any;
  let activity: ReturnType<typeof createAuthServiceMocks>['activity'];

  beforeEach(async () => {
    const mocks = createAuthServiceMocks();
    ({ userRepository, refreshTokenRepository, twoFactorService, activity } = mocks);
    ({ auth: service } = await createAuthServices(mocks));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
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
      expect(activity.recordSignIn).toHaveBeenCalledWith(mockUser);
    });

    it('should require a two-factor challenge before creating a session', async () => {
      const protectedUser = { ...mockUser, twoFactorEnabled: true };
      userRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
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
        orderBy: jest.fn().mockReturnThis(),
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
      // Only the live account's wrong password is in an activity
      expect(activity.record).toHaveBeenCalledTimes(1);
    });

    it('does not reveal that an account signs in with another provider', async () => {
      const error = await loginFailure(
        { ...mockUser, authProvider: 'google', passwordHash: null },
        true,
      );

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect(error.message).toBe('Invalid email or password');
      expect(bcrypt.compare).toHaveBeenCalledTimes(1);
      expect(activity.record).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };
      userRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expectApiError(service.login({
          identifier: 'test@example.com',
          password: 'wrongpassword',
        }), UnauthorizedException, 'AUTH_INVALID_CREDENTIALS');
      expect(activity.record).toHaveBeenCalledWith(mockUser.id, 'sign_in_refused');
      expect(activity.recordSignIn).not.toHaveBeenCalled();
    });
  });
});
