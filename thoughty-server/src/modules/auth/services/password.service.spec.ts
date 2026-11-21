import {
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RefreshToken, User } from '@/database/entities';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import * as bcrypt from 'bcryptjs';
import { PasswordService } from './password.service';
import {
  createAuthServiceMocks,
  createAuthServices,
  mockUser,
} from './auth-services.test-helpers';

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

describe('PasswordService', () => {
  let service: PasswordService;
  let userRepository: any;
  let refreshTokenRepository: any;
  let emailService: any;
  let activity: ReturnType<typeof createAuthServiceMocks>['activity'];

  beforeEach(async () => {
    const mocks = createAuthServiceMocks();
    ({ userRepository, refreshTokenRepository, emailService, activity } = mocks);
    ({ passwords: service } = await createAuthServices(mocks));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
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
      expect(activity.record).toHaveBeenCalledWith(1, 'password_changed');
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

      await expectApiError(service.changePassword(1, {
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword',
        }), UnauthorizedException, 'AUTH_CURRENT_PASSWORD_INCORRECT');
    });
  });

  describe('forgotPassword', () => {
    const MESSAGE = 'If an account exists with this email, a reset link will be sent.';
    const flush = () => new Promise((resolve) => setImmediate(resolve));

    beforeEach(() => {
      userRepository.update = jest.fn().mockResolvedValue({ affected: 1 });
    });

    it('stores a hashed one-hour token and emails its link to a local account', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.forgotPassword('Test@Example.com');
      await flush();

      expect(result).toEqual({ success: true, message: MESSAGE });
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      const [, stored] = userRepository.update.mock.calls[0];
      expect(userRepository.update).toHaveBeenCalledWith({ id: 1 }, expect.anything());
      const link = emailService.sendPasswordResetEmail.mock.calls[0][1] as string;
      const token = /token=([0-9a-f]+)$/.exec(link)?.[1] ?? '';
      expect(token).toMatch(/^[0-9a-f]{64}$/);
      expect(stored.resetToken).toBe(createHash('sha256').update(token).digest('hex'));
      expect(stored.resetTokenExpires.getTime() - Date.now()).toBeGreaterThan(59 * 60 * 1000);
      expect(stored.resetTokenExpires.getTime() - Date.now()).toBeLessThanOrEqual(60 * 60 * 1000);
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringMatching(/\/reset-password\?token=[0-9a-f]{64}$/),
      );
    });

    it('answers before the token is stored, like for an unknown address', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.update.mockReturnValue(new Promise(() => undefined));

      await expect(service.forgotPassword('test@example.com')).resolves.toEqual({ success: true, message: MESSAGE });

      expect(userRepository.update).toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('answers before the mail server does', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      emailService.sendPasswordResetEmail.mockReturnValue(new Promise(() => undefined));

      const result = await service.forgotPassword('test@example.com');
      await flush();

      expect(result.success).toBe(true);
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it.each([
      ['an unknown address', null],
      ['a deleted account', { ...mockUser, deletedAt: new Date() }],
      ['a Google account', { ...mockUser, authProvider: 'google' }],
    ])('answers the same for %s and stores or sends nothing', async (_label, user) => {
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.forgotPassword('test@example.com');
      await flush();

      expect(result).toEqual({ success: true, message: MESSAGE });
      expect(userRepository.update).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it.each([
      ['the token cannot be stored', 'update', new Error('connection lost'), 'Error', 'connection lost'],
      ['the email fails', 'email', new Error('SMTP error'), 'Error', 'SMTP error'],
      ['something that is not an Error is thrown', 'email', 'nope', 'UnknownError', 'Unknown error'],
    ])('logs, without the address, when %s', async (_label, step, failure, errorName, errorMessage) => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      userRepository.findOne.mockResolvedValue(mockUser);
      if (step === 'update') {
        userRepository.update.mockRejectedValue(failure);
      } else {
        emailService.sendPasswordResetEmail.mockRejectedValue(failure);
      }

      const result = await service.forgotPassword('test@example.com');
      await flush();

      expect(result.success).toBe(true);
      expect(warn).toHaveBeenCalledWith('Password reset link not sent', { errorName, errorMessage, userId: 1 });
      expect(JSON.stringify(warn.mock.calls)).not.toContain('test@example.com');
      if (step === 'update') {
        expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      }
    });
  });

  describe('resetPassword', () => {
    let queryBuilder: Record<string, jest.Mock>;
    let manager: { createQueryBuilder: jest.Mock; delete: jest.Mock };

    beforeEach(() => {
      queryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ raw: [{ id: 7 }] }),
      };
      manager = {
        createQueryBuilder: jest.fn(() => queryBuilder),
        delete: jest.fn().mockResolvedValue({ affected: 2 }),
      };
      userRepository.manager = {
        transaction: jest.fn((work: (entityManager: typeof manager) => Promise<unknown>) => work(manager)),
      };
    });

    it('claims an unexpired link of a live account, sets the password and signs every session out', async () => {
      const result = await service.resetPassword('valid_token', 'NewPass1!');

      expect(result).toEqual({ success: true, message: 'Password reset successfully' });
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass1!', 12);
      expect(queryBuilder.update).toHaveBeenCalledWith(User);
      expect(queryBuilder.set).toHaveBeenCalledWith({
        passwordHash: 'hashed_password',
        resetToken: null,
        resetTokenExpires: null,
        twoFactorChallengeTokenHash: null,
        twoFactorChallengeCodeHash: null,
        twoFactorChallengePurpose: null,
        twoFactorChallengeExpires: null,
      });
      expect(queryBuilder.where).toHaveBeenCalledWith('reset_token = :tokenHash', {
        tokenHash: createHash('sha256').update('valid_token').digest('hex'),
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('reset_token_expires > :now', { now: expect.any(Date) });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('deleted_at IS NULL');
      expect(manager.delete).toHaveBeenCalledWith(RefreshToken, { userId: 7 });
      expect(activity.record).toHaveBeenCalledWith(7, 'password_reset');
    });

    it.each([
      ['no row', { raw: [] }],
      ['no answer', { raw: undefined }],
    ])('refuses a used, expired or unknown link (%s) and signs nobody out', async (_label, answer) => {
      queryBuilder.execute.mockResolvedValue(answer);

      await expectApiError(service.resetPassword('invalid_token', 'NewPass1!'), BadRequestException, 'AUTH_INVALID_RESET_TOKEN');
      expect(manager.delete).not.toHaveBeenCalled();
      expect(activity.record).not.toHaveBeenCalled();
    });
  });
});
