import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { MoreThan } from 'typeorm';
import { User } from '@/database/entities';
import { EmailService } from './email.service';
import { EmailVerificationService } from './email-verification.service';

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;
  let userRepository: any;
  let emailService: any;

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
    };
    emailService = {
      sendEmailVerificationEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailVerificationService,
        { provide: getRepositoryToken(User), useValue: userRepository },
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

    await expect(service.verifyEmail('bad-token')).rejects.toThrow(BadRequestException);
  });
});
