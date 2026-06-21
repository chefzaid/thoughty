import { Test, TestingModule } from '@nestjs/testing';
import { RATE_LIMITS } from '@/common';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { EmailVerificationService } from './services/email-verification.service';

const getThrottleMetadata = (handler: Function) => ({
  limit: Reflect.getMetadata('THROTTLER:LIMITdefault', handler),
  ttl: Reflect.getMetadata('THROTTLER:TTLdefault', handler),
});

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;
  let emailVerificationService: any;

  const mockUser = { userId: 1, email: 'test@example.com' };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      oauthLogin: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
      listSessions: jest.fn(),
      revokeSession: jest.fn(),
      revokeOtherSessions: jest.fn(),
      getMe: jest.fn(),
      changePassword: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      deleteAccount: jest.fn(),
    };
    emailVerificationService = {
      sendVerificationEmail: jest.fn(),
      verifyEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: EmailVerificationService, useValue: emailVerificationService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('rate limiting', () => {
    const cases = [
      ['register', RATE_LIMITS.authAttempt],
      ['login', RATE_LIMITS.authAttempt],
      ['oauth', RATE_LIMITS.authAttempt],
      ['refresh', RATE_LIMITS.tokenRefresh],
      ['revokeOtherSessions', RATE_LIMITS.accountSecurity],
      ['revokeSession', RATE_LIMITS.accountSecurity],
      ['changePassword', RATE_LIMITS.accountSecurity],
      ['forgotPassword', RATE_LIMITS.passwordRecovery],
      ['resetPassword', RATE_LIMITS.passwordRecovery],
      ['verifyEmail', RATE_LIMITS.passwordRecovery],
      ['resendVerificationEmail', RATE_LIMITS.accountSecurity],
      ['deleteAccount', RATE_LIMITS.accountSecurity],
    ] as const;

    it.each(cases)('applies the calibrated %s throttle', (methodName, expected) => {
      const handler = AuthController.prototype[methodName];

      expect(getThrottleMetadata(handler)).toEqual(expected);
    });
  });

  describe('register', () => {
    it('delegates to authService.register', async () => {
      const dto = { email: 'a@b.com', password: 'Pass123!@' } as any;
      const expected = { user: { id: 1 }, accessToken: 'token', refreshToken: 'rt' };
      authService.register!.mockResolvedValue(expected as any);
      emailVerificationService.sendVerificationEmail.mockResolvedValue({ success: true });

      const result = await controller.register(dto);
      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(emailVerificationService.sendVerificationEmail).toHaveBeenCalledWith(1);
      expect(result).toBe(expected);
    });
  });

  describe('login', () => {
    it('delegates to authService.login', async () => {
      const dto = { identifier: 'a@b.com', password: 'Pass123!@' };
      const expected = { accessToken: 'token', refreshToken: 'rt' };
      authService.login!.mockResolvedValue(expected as any);

      const result = await controller.login(dto);
      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });
  });

  describe('oauth', () => {
    it('delegates to authService.oauthLogin', async () => {
      const dto = { provider: 'google' as const, providerId: '123', email: 'a@b.com' };
      const expected = { accessToken: 'token' };
      authService.oauthLogin!.mockResolvedValue(expected as any);

      const result = await controller.oauth(dto);
      expect(authService.oauthLogin).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });
  });

  describe('refresh', () => {
    it('delegates to authService.refreshToken', async () => {
      const dto = { refreshToken: 'rt' };
      const expected = { accessToken: 'new_token' };
      authService.refreshToken!.mockResolvedValue(expected);

      const result = await controller.refresh(dto);
      expect(authService.refreshToken).toHaveBeenCalledWith('rt');
      expect(result).toBe(expected);
    });
  });

  describe('logout', () => {
    it('delegates to authService.logout', async () => {
      const dto = { refreshToken: 'rt' };
      const expected = { success: true };
      authService.logout!.mockResolvedValue(expected);

      const result = await controller.logout(dto);
      expect(authService.logout).toHaveBeenCalledWith('rt');
      expect(result).toEqual(expected);
    });
  });

  describe('sessions', () => {
    it('delegates session listing with the current refresh token header', async () => {
      const expected = [{ id: 1, current: true }];
      authService.listSessions.mockResolvedValue(expected);

      const result = await controller.listSessions(mockUser as any, 'rt');

      expect(authService.listSessions).toHaveBeenCalledWith(1, 'rt');
      expect(result).toBe(expected);
    });

    it('delegates single-session revocation', async () => {
      const expected = { success: true };
      authService.revokeSession.mockResolvedValue(expected);

      const result = await controller.revokeSession(mockUser as any, 2, 'rt');

      expect(authService.revokeSession).toHaveBeenCalledWith(1, 2, 'rt');
      expect(result).toBe(expected);
    });

    it('delegates other-session revocation', async () => {
      const expected = { success: true };
      authService.revokeOtherSessions.mockResolvedValue(expected);

      const result = await controller.revokeOtherSessions(mockUser as any, 'rt');

      expect(authService.revokeOtherSessions).toHaveBeenCalledWith(1, 'rt');
      expect(result).toBe(expected);
    });
  });

  describe('getMe', () => {
    it('delegates to authService.getMe with userId', async () => {
      const expected = { id: 1, email: 'test@example.com' };
      authService.getMe!.mockResolvedValue(expected as any);

      const result = await controller.getMe(mockUser as any);
      expect(authService.getMe).toHaveBeenCalledWith(1);
      expect(result).toBe(expected);
    });
  });

  describe('changePassword', () => {
    it('delegates to authService.changePassword', async () => {
      const dto = { currentPassword: 'old', newPassword: 'New123!@' };
      const expected = { success: true, message: 'Changed' };
      authService.changePassword!.mockResolvedValue(expected);

      const result = await controller.changePassword(mockUser as any, dto);
      expect(authService.changePassword).toHaveBeenCalledWith(1, dto);
      expect(result).toBe(expected);
    });
  });

  describe('forgotPassword', () => {
    it('delegates to authService.forgotPassword', async () => {
      const dto = { email: 'a@b.com' };
      const expected = { success: true, message: 'Sent' };
      authService.forgotPassword!.mockResolvedValue(expected);

      const result = await controller.forgotPassword(dto);
      expect(authService.forgotPassword).toHaveBeenCalledWith('a@b.com');
      expect(result).toBe(expected);
    });
  });

  describe('resetPassword', () => {
    it('delegates to authService.resetPassword', async () => {
      const dto = { token: 'reset_token', newPassword: 'New123!@' };
      const expected = { success: true, message: 'Reset' };
      authService.resetPassword!.mockResolvedValue(expected);

      const result = await controller.resetPassword(dto);
      expect(authService.resetPassword).toHaveBeenCalledWith('reset_token', 'New123!@');
      expect(result).toBe(expected);
    });
  });

  describe('verifyEmail', () => {
    it('delegates to emailVerificationService.verifyEmail', async () => {
      const expected = { success: true, message: 'Verified' };
      emailVerificationService.verifyEmail.mockResolvedValue(expected);

      const result = await controller.verifyEmail({ token: 'verification-token' });
      expect(emailVerificationService.verifyEmail).toHaveBeenCalledWith('verification-token');
      expect(result).toBe(expected);
    });
  });

  describe('resendVerificationEmail', () => {
    it('delegates to emailVerificationService.sendVerificationEmail with userId', async () => {
      const expected = { success: true, message: 'Sent' };
      emailVerificationService.sendVerificationEmail.mockResolvedValue(expected);

      const result = await controller.resendVerificationEmail(mockUser as any);
      expect(emailVerificationService.sendVerificationEmail).toHaveBeenCalledWith(1);
      expect(result).toBe(expected);
    });
  });

  describe('deleteAccount', () => {
    it('delegates to authService.deleteAccount', async () => {
      const dto = { password: 'Pass123!@' };
      const expected = { success: true, message: 'Deleted' };
      authService.deleteAccount!.mockResolvedValue(expected);

      const result = await controller.deleteAccount(mockUser as any, dto);
      expect(authService.deleteAccount).toHaveBeenCalledWith(1, 'Pass123!@');
      expect(result).toBe(expected);
    });
  });
});
