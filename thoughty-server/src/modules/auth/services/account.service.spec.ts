import {
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AccountService } from './account.service';
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

describe('AccountService', () => {
  let service: AccountService;
  let userRepository: any;
  let refreshTokenRepository: any;
  let emailService: any;

  beforeEach(async () => {
    const mocks = createAuthServiceMocks();
    ({ userRepository, refreshTokenRepository, emailService } = mocks);
    ({ account: service } = await createAuthServices(mocks));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
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
