import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { MoreThan } from 'typeorm';
import { Setting, User } from '@/database/entities';
import { EmailService } from './email.service';
import { EmailVerificationService } from './email-verification.service';

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;
  let userRepository: any;
  let emailService: any;
  let settingRepository: { findOne: jest.Mock };

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    emailVerified: false,
    emailVerificationToken: null,
    emailVerificationTokenExpires: null,
  };

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
    };
    settingRepository = { findOne: jest.fn().mockResolvedValue(null) };
    emailService = {
      isConfigured: jest.fn().mockReturnValue(true),
      sendEmailVerificationEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailVerificationService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Setting), useValue: settingRepository },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('https://thoughty.test') } },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<EmailVerificationService>(EmailVerificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('stores a hashed verification token and sends the raw token by email', async () => {
    userRepository.findOne.mockResolvedValue({ ...mockUser });
    userRepository.save.mockImplementation((user: any) => Promise.resolve(user));

    const result = await service.sendVerificationEmail(1);

    expect(result.success).toBe(true);
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        emailVerificationToken: expect.any(String),
        emailVerificationTokenExpires: expect.any(Date),
      }),
    );
    const savedToken = userRepository.save.mock.calls[0][0].emailVerificationToken;
    const verificationUrl = emailService.sendEmailVerificationEmail.mock.calls[0][1];
    const rawToken = new URL(verificationUrl).searchParams.get('token');

    expect(rawToken).toBeTruthy();
    expect(savedToken).not.toBe(rawToken);
    expect(verificationUrl).toContain('https://thoughty.test/verify-email?token=');
  });

  it('returns success without sending when email is already verified', async () => {
    userRepository.findOne.mockResolvedValue({ ...mockUser, emailVerified: true });

    const result = await service.sendVerificationEmail(1);

    expect(result).toEqual({ success: true, message: 'Email already verified' });
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(emailService.sendEmailVerificationEmail).not.toHaveBeenCalled();
  });

  it('refuses a requested resend while no mail server is configured, before storing a token', async () => {
    userRepository.findOne.mockResolvedValue({ ...mockUser });
    emailService.isConfigured.mockReturnValue(false);

    await expectApiError(
      service.sendVerificationEmail(1, { requireDelivery: true }),
      ServiceUnavailableException,
      'EMAIL_DELIVERY_NOT_CONFIGURED',
    );
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(emailService.sendEmailVerificationEmail).not.toHaveBeenCalled();
  });

  it('sends a requested resend when mail is configured, and answers an already verified email either way', async () => {
    userRepository.findOne.mockResolvedValue({ ...mockUser });
    userRepository.save.mockImplementation((user: any) => Promise.resolve(user));

    await expect(service.sendVerificationEmail(1, { requireDelivery: true })).resolves.toEqual({
      success: true,
      message: 'Verification email sent',
    });
    expect(emailService.sendEmailVerificationEmail).toHaveBeenCalledTimes(1);

    emailService.isConfigured.mockReturnValue(false);
    userRepository.findOne.mockResolvedValue({ ...mockUser, emailVerified: true });
    await expect(service.sendVerificationEmail(1, { requireDelivery: true })).resolves.toEqual({
      success: true,
      message: 'Email already verified',
    });
  });

  it('throws when resending for an unknown user', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(service.sendVerificationEmail(999)).rejects.toThrow(NotFoundException);
  });

  it('handles email provider failure after storing the token', async () => {
    userRepository.findOne.mockResolvedValue({ ...mockUser });
    userRepository.save.mockImplementation((user: any) => Promise.resolve(user));
    emailService.sendEmailVerificationEmail.mockRejectedValue(new Error('SMTP error'));
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await service.sendVerificationEmail(1);

    expect(result.success).toBe(true);
    expect(userRepository.save).toHaveBeenCalled();
  });

  it('verifies a valid token and clears token fields', async () => {
    const user = {
      ...mockUser,
      emailVerificationToken: 'hashed-token',
      emailVerificationTokenExpires: new Date(Date.now() + 1000),
    };
    userRepository.findOne.mockResolvedValue(user);
    userRepository.save.mockResolvedValue(user);

    const result = await service.verifyEmail('raw-token');

    expect(result).toEqual({ success: true, message: 'Email verified successfully' });
    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: {
        emailVerificationToken: expect.any(String),
        emailVerificationTokenExpires: MoreThan(expect.any(Date)),
      },
    });
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpires: null,
      }),
    );
  });

  it('rejects invalid or expired verification tokens', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expectApiError(service.verifyEmail('bad-token'), BadRequestException, 'AUTH_INVALID_VERIFICATION_TOKEN');
  });

  describe('an account with a placeholder address', () => {
    const placeholder = { ...mockUser, email: 'user-1@invalid', pendingEmail: null };
    const unique = Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'users_email_key' });

    beforeEach(() => {
      userRepository.save.mockImplementation((user: any) => Promise.resolve(user));
    });

    it('has nothing to verify until it gives an address', async () => {
      userRepository.findOne.mockResolvedValue({ ...placeholder });

      await expectApiError(service.sendVerificationEmail(1, { requireDelivery: true }), BadRequestException, 'AUTH_EMAIL_MISSING');
      expect(emailService.sendEmailVerificationEmail).not.toHaveBeenCalled();
    });

    it('keeps the address it gives waiting, in lower case, and emails its link there', async () => {
      userRepository.findOne.mockResolvedValue({ ...placeholder });

      await service.addEmail(1, ' Writer@Example.com ');

      expect(userRepository.exists).toHaveBeenCalledWith({ where: { email: 'writer@example.com' } });
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user-1@invalid',
          pendingEmail: 'writer@example.com',
          emailVerificationToken: expect.any(String),
        }),
      );
      expect(emailService.sendEmailVerificationEmail).toHaveBeenCalledWith(
        'writer@example.com',
        expect.stringContaining('https://thoughty.test/verify-email?token='),
        undefined,
      );
    });

    it('writes the link in the account’s language', async () => {
      userRepository.findOne.mockResolvedValue({ ...placeholder });
      settingRepository.findOne.mockResolvedValue({ value: 'fr' });

      await service.addEmail(1, 'writer@example.com');

      expect(settingRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 1, key: 'language' },
        select: { value: true },
      });
      expect(emailService.sendEmailVerificationEmail).toHaveBeenCalledWith('writer@example.com', expect.any(String), 'fr');
    });

    it('sends a requested resend to the waiting address', async () => {
      userRepository.findOne.mockResolvedValue({ ...placeholder, pendingEmail: 'writer@example.com' });

      await service.sendVerificationEmail(1, { requireDelivery: true });

      expect(emailService.sendEmailVerificationEmail).toHaveBeenCalledWith('writer@example.com', expect.any(String), undefined);
    });

    it('sets the waiting address, verified, when its link is opened', async () => {
      userRepository.findOne.mockResolvedValue({ ...placeholder, pendingEmail: 'writer@example.com' });

      await service.verifyEmail('raw-token');

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'writer@example.com', pendingEmail: null, emailVerified: true }),
      );
    });

    it('refuses as taken an address another account took before the link was opened', async () => {
      userRepository.findOne.mockResolvedValue({ ...placeholder, pendingEmail: 'writer@example.com' });
      userRepository.save.mockRejectedValue(unique);

      await expectApiError(service.verifyEmail('raw-token'), ConflictException, 'AUTH_EMAIL_TAKEN');
    });

    it('lets any other failure through', async () => {
      userRepository.findOne.mockResolvedValue({ ...placeholder, pendingEmail: 'writer@example.com' });
      userRepository.save.mockRejectedValue(new Error('connection lost'));

      await expect(service.verifyEmail('raw-token')).rejects.toThrow('connection lost');
    });

    it('refuses an address another account has, and an account that has one already', async () => {
      userRepository.findOne.mockResolvedValue({ ...placeholder });
      userRepository.exists.mockResolvedValue(true);
      await expectApiError(service.addEmail(1, 'taken@example.com'), ConflictException, 'AUTH_EMAIL_TAKEN');

      userRepository.findOne.mockResolvedValue({ ...mockUser });
      await expectApiError(service.addEmail(1, 'other@example.com'), ConflictException, 'AUTH_EMAIL_ALREADY_SET');
      expect(userRepository.save).not.toHaveBeenCalled();
      expect(emailService.sendEmailVerificationEmail).not.toHaveBeenCalled();
    });

    it('sets the address at once, unverified, without a mail server outside production', async () => {
      userRepository.findOne.mockResolvedValue({ ...placeholder, pendingEmail: 'old@example.com' });
      emailService.isConfigured.mockReturnValue(false);

      await service.addEmail(1, 'writer@example.com');

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'writer@example.com', pendingEmail: null, emailVerified: false }),
      );
      expect(emailService.sendEmailVerificationEmail).not.toHaveBeenCalled();

      userRepository.save.mockRejectedValue(unique);
      userRepository.findOne.mockResolvedValue({ ...placeholder });
      await expectApiError(service.addEmail(1, 'writer@example.com'), ConflictException, 'AUTH_EMAIL_TAKEN');
    });

    it('refuses without a mail server in production', async () => {
      userRepository.findOne.mockResolvedValue({ ...placeholder });
      emailService.isConfigured.mockReturnValue(false);
      const environment = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await expectApiError(service.addEmail(1, 'writer@example.com'), ServiceUnavailableException, 'EMAIL_DELIVERY_NOT_CONFIGURED');
      } finally {
        process.env.NODE_ENV = environment;
      }
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });
});
