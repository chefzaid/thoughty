import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { RATE_LIMITS } from '@/common';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { EmailVerificationService } from './services/email-verification.service';
import { TwoFactorService } from './services/two-factor.service';

const COOKIE = 'thoughty_refresh_token';
const COOKIE_OPTIONS = { httpOnly: true, secure: false, sameSite: 'strict', path: '/api/auth' };

const mockResponse = () =>
  ({ cookie: jest.fn(), clearCookie: jest.fn() }) as unknown as Response & {
    cookie: jest.Mock;
    clearCookie: jest.Mock;
  };

const requestWithCookie = (cookie?: string) => ({ headers: { cookie } }) as unknown as Request;

const getThrottleMetadata = (handler: Function) => ({
  limit: Reflect.getMetadata('THROTTLER:LIMITdefault', handler),
  ttl: Reflect.getMetadata('THROTTLER:TTLdefault', handler),
});

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;
  let emailVerificationService: any;
  let twoFactorService: any;

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
    twoFactorService = {
      resend: jest.fn(),
      status: jest.fn(),
      startSetup: jest.fn(),
      enable: jest.fn(),
      disable: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: EmailVerificationService, useValue: emailVerificationService },
        { provide: TwoFactorService, useValue: twoFactorService },
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
      ['verifyTwoFactor', RATE_LIMITS.authAttempt],
      ['resendTwoFactor', RATE_LIMITS.authAttempt],
      ['oauth', RATE_LIMITS.authAttempt],
      ['refresh', RATE_LIMITS.tokenRefresh],
      ['revokeOtherSessions', RATE_LIMITS.accountSecurity],
      ['setupTwoFactor', RATE_LIMITS.accountSecurity],
      ['enableTwoFactor', RATE_LIMITS.accountSecurity],
      ['disableTwoFactor', RATE_LIMITS.accountSecurity],
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
    it('signs the new user in with a refresh token cookie only', async () => {
      const dto = { email: 'a@b.com', password: 'Pass123!@' } as any;
      authService.register!.mockResolvedValue({
        user: { id: 1 },
        accessToken: 'token',
        refreshToken: 'rt',
      });
      emailVerificationService.sendVerificationEmail.mockResolvedValue({ success: true });
      const res = mockResponse();

      const result = await controller.register(dto, res);
      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(emailVerificationService.sendVerificationEmail).toHaveBeenCalledWith(1);
      expect(result).toEqual({ user: { id: 1 }, accessToken: 'token' });
      expect(res.cookie).toHaveBeenCalledWith(COOKIE, 'rt', {
        ...COOKIE_OPTIONS,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    });
  });

  describe('login', () => {
    it('moves the refresh token out of the body into an httpOnly cookie', async () => {
      const dto = { identifier: 'a@b.com', password: 'Pass123!@' };
      authService.login!.mockResolvedValue({
        user: { id: 1 },
        accessToken: 'token',
        refreshToken: 'rt',
      });
      const res = mockResponse();

      const result = await controller.login(dto, res);
      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ user: { id: 1 }, accessToken: 'token' });
      expect(result).not.toHaveProperty('refreshToken');
      expect(res.cookie).toHaveBeenCalledWith(
        COOKIE,
        'rt',
        expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/api/auth' }),
      );
    });

    it('marks the cookie Secure in production', async () => {
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        authService.login!.mockResolvedValue({
          user: { id: 1 },
          accessToken: 't',
          refreshToken: 'rt',
        });
        const res = mockResponse();

        await controller.login({ identifier: 'a', password: 'b' }, res);
        expect(res.cookie).toHaveBeenCalledWith(
          COOKIE,
          'rt',
          expect.objectContaining({ secure: true }),
        );
      } finally {
        process.env.NODE_ENV = previous;
      }
    });

    it('returns a two-factor challenge without setting a cookie', async () => {
      const challenge = { twoFactorRequired: true, challengeToken: 'c', expiresInSeconds: 600 };
      authService.login!.mockResolvedValue(challenge);
      const res = mockResponse();

      await expect(controller.login({ identifier: 'a', password: 'b' }, res)).resolves.toBe(
        challenge,
      );
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('two-factor authentication', () => {
    const challenge = {
      twoFactorRequired: true,
      challengeToken: 'challenge-token',
      expiresInSeconds: 600,
    };

    it('verifies a login challenge through authService', async () => {
      const dto = { challengeToken: 'challenge-token', code: '123456' };
      authService.verifyTwoFactorLogin = jest
        .fn()
        .mockResolvedValue({ accessToken: 'token', refreshToken: 'refresh', user: { id: 1 } });
      const res = mockResponse();

      await expect(controller.verifyTwoFactor(dto, res)).resolves.toEqual({
        accessToken: 'token',
        user: { id: 1 },
      });
      expect(authService.verifyTwoFactorLogin).toHaveBeenCalledWith(dto);
      expect(res.cookie).toHaveBeenCalledWith(COOKIE, 'refresh', expect.any(Object));
    });

    it('resends a public challenge', async () => {
      twoFactorService.resend.mockResolvedValue(challenge);

      await expect(controller.resendTwoFactor({ challengeToken: 'challenge-token' })).resolves.toBe(
        challenge,
      );
      expect(twoFactorService.resend).toHaveBeenCalledWith('challenge-token');
    });

    it('returns status for the authenticated user', async () => {
      const status = { enabled: false, available: true, emailVerified: true };
      twoFactorService.status.mockResolvedValue(status);

      await expect(controller.twoFactorStatus(mockUser as any)).resolves.toBe(status);
      expect(twoFactorService.status).toHaveBeenCalledWith(1);
    });

    it('starts and confirms setup for the authenticated user', async () => {
      const dto = { challengeToken: 'challenge-token', code: '123456' };
      twoFactorService.startSetup.mockResolvedValue(challenge);
      twoFactorService.enable.mockResolvedValue({ success: true });

      await expect(controller.setupTwoFactor(mockUser as any)).resolves.toBe(challenge);
      await expect(controller.enableTwoFactor(mockUser as any, dto)).resolves.toEqual({
        success: true,
      });
      expect(twoFactorService.startSetup).toHaveBeenCalledWith(1);
      expect(twoFactorService.enable).toHaveBeenCalledWith(1, dto);
    });

    it('disables two-factor authentication with password confirmation', async () => {
      twoFactorService.disable.mockResolvedValue({ success: true });

      await expect(
        controller.disableTwoFactor(mockUser as any, { password: 'Password123!' }),
      ).resolves.toEqual({ success: true });
      expect(twoFactorService.disable).toHaveBeenCalledWith(1, 'Password123!');
    });
  });

  describe('oauth', () => {
    it('delegates the Google credential and sets the refresh token cookie', async () => {
      const dto = { provider: 'google' as const, credential: 'google-id-token' };
      authService.oauthLogin!.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'rt',
        user: { id: 1 },
      });
      const res = mockResponse();

      const result = await controller.oauth(dto, res);
      expect(authService.oauthLogin).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ accessToken: 'token', user: { id: 1 } });
      expect(res.cookie).toHaveBeenCalledWith(COOKIE, 'rt', expect.any(Object));
    });

    it('sets no cookie when the credential is refused', async () => {
      authService.oauthLogin!.mockRejectedValue(new ServiceUnavailableException());
      const res = mockResponse();

      await expect(
        controller.oauth({ provider: 'google', credential: 'x' }, res),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('sso', () => {
    it('sets the refresh token cookie after the Keycloak exchange', async () => {
      authService.keycloakLogin = jest
        .fn()
        .mockResolvedValue({ accessToken: 'token', refreshToken: 'rt', user: { id: 1 } });
      const res = mockResponse();

      await expect(controller.sso(res, 'keycloak-token')).resolves.toEqual({
        accessToken: 'token',
        user: { id: 1 },
      });
      expect(authService.keycloakLogin).toHaveBeenCalledWith('keycloak-token');
      expect(res.cookie).toHaveBeenCalledWith(COOKIE, 'rt', expect.any(Object));
    });
  });

  describe('refresh', () => {
    it('reads the cookie, rotates it, and returns only the access token', async () => {
      authService.refreshToken!.mockResolvedValue({
        accessToken: 'new_token',
        refreshToken: 'new_rt',
      });
      const res = mockResponse();

      const result = await controller.refresh(
        requestWithCookie(`theme=dark; ${COOKIE}=old_rt`),
        res,
        {},
      );
      expect(authService.refreshToken).toHaveBeenCalledWith('old_rt');
      expect(result).toEqual({ accessToken: 'new_token' });
      expect(res.cookie).toHaveBeenCalledWith(COOKIE, 'new_rt', expect.any(Object));
    });

    it('prefers the cookie over a legacy body token', async () => {
      authService.refreshToken!.mockResolvedValue({ accessToken: 'a', refreshToken: 'b' });

      await controller.refresh(requestWithCookie(`${COOKIE}=cookie_rt`), mockResponse(), {
        refreshToken: 'body_rt',
      });
      expect(authService.refreshToken).toHaveBeenCalledWith('cookie_rt');
    });

    it('exchanges a legacy body token for the cookie when no cookie is present', async () => {
      authService.refreshToken!.mockResolvedValue({ accessToken: 'a', refreshToken: 'b' });
      const res = mockResponse();

      await controller.refresh(requestWithCookie(), res, { refreshToken: 'legacy_rt' });
      expect(authService.refreshToken).toHaveBeenCalledWith('legacy_rt');
      expect(res.cookie).toHaveBeenCalledWith(COOKIE, 'b', expect.any(Object));
    });

    it('clears the cookie when the refresh token is rejected', async () => {
      authService.refreshToken!.mockRejectedValue(new UnauthorizedException());
      const res = mockResponse();

      await expect(
        controller.refresh(requestWithCookie(`${COOKIE}=reused`), res, {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(res.clearCookie).toHaveBeenCalledWith(COOKIE, COOKIE_OPTIONS);
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('keeps the cookie after a transient failure', async () => {
      authService.refreshToken!.mockRejectedValue(new Error('database unavailable'));
      const res = mockResponse();

      await expect(controller.refresh(requestWithCookie(`${COOKIE}=rt`), res, {})).rejects.toThrow(
        'database unavailable',
      );
      expect(res.clearCookie).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes the cookie token and clears the cookie', async () => {
      authService.logout!.mockResolvedValue({ success: true });
      const res = mockResponse();

      const result = await controller.logout(requestWithCookie(`${COOKIE}=rt`), res);
      expect(authService.logout).toHaveBeenCalledWith('rt');
      expect(res.clearCookie).toHaveBeenCalledWith(COOKIE, COOKIE_OPTIONS);
      expect(result).toEqual({ success: true });
    });
  });

  describe('sessions', () => {
    it('delegates session listing with the refresh token cookie', async () => {
      const expected = [{ id: 1, current: true }];
      authService.listSessions.mockResolvedValue(expected);

      const result = await controller.listSessions(
        mockUser as any,
        requestWithCookie(`${COOKIE}=rt`),
      );

      expect(authService.listSessions).toHaveBeenCalledWith(1, 'rt');
      expect(result).toBe(expected);
    });

    it('delegates single-session revocation', async () => {
      const expected = { success: true };
      authService.revokeSession.mockResolvedValue(expected);

      const result = await controller.revokeSession(
        mockUser as any,
        2,
        requestWithCookie(`${COOKIE}=rt`),
      );

      expect(authService.revokeSession).toHaveBeenCalledWith(1, 2, 'rt');
      expect(result).toBe(expected);
    });

    it('delegates other-session revocation', async () => {
      const expected = { success: true };
      authService.revokeOtherSessions.mockResolvedValue(expected);

      const result = await controller.revokeOtherSessions(
        mockUser as any,
        requestWithCookie(`${COOKIE}=rt`),
      );

      expect(authService.revokeOtherSessions).toHaveBeenCalledWith(1, 'rt');
      expect(result).toBe(expected);
    });

    it('passes no token when the cookie is absent', async () => {
      authService.listSessions.mockResolvedValue([]);

      await controller.listSessions(mockUser as any, requestWithCookie('other=1'));

      expect(authService.listSessions).toHaveBeenCalledWith(1, undefined);
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

      const res = mockResponse();

      const result = await controller.deleteAccount(mockUser as any, dto, res);
      expect(authService.deleteAccount).toHaveBeenCalledWith(1, 'Pass123!@');
      expect(result).toBe(expected);
      expect(res.clearCookie).toHaveBeenCalledWith(COOKIE, COOKIE_OPTIONS);
    });
  });
});
