import {
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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

  beforeEach(async () => {
    const mocks = createAuthServiceMocks();
    ({ userRepository, refreshTokenRepository, emailService } = mocks);
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
});
