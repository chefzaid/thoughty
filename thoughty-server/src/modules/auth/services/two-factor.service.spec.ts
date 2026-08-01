import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '@/database/entities';
import { EmailService } from './email.service';
import { TwoFactorService } from './two-factor.service';

jest.mock('bcryptjs', () => ({ compare: jest.fn() }));

describe('TwoFactorService', () => {
  let service: TwoFactorService;
  let userRepository: any;
  let emailService: any;

  const createUser = (overrides: Partial<User> = {}) =>
    ({
      id: 7,
      email: 'verified@example.com',
      username: 'verified',
      passwordHash: 'password-hash',
      authProvider: 'local',
      emailVerified: true,
      twoFactorEnabled: false,
      deletedAt: null,
      twoFactorChallengeTokenHash: null,
      twoFactorChallengeCodeHash: null,
      twoFactorChallengePurpose: null,
      twoFactorChallengeExpires: null,
      ...overrides,
    }) as User;

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      save: jest.fn((user) => Promise.resolve(user)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    emailService = {
      isConfigured: jest.fn().mockReturnValue(true),
      sendTwoFactorCodeEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: string) =>
              key === 'TWO_FACTOR_SECRET' ? 'two-factor-test-secret' : fallback,
            ),
          },
        },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get(TwoFactorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  async function issueChallenge(user: User, purpose: 'login' | 'enable') {
    const result = await service.startChallenge(user, purpose);
    const code = emailService.sendTwoFactorCodeEmail.mock.calls[0][1] as string;
    return { result, code };
  }

  it('stores hashed setup credentials and emails a six-digit code', async () => {
    const user = createUser();

    const { result, code } = await issueChallenge(user, 'enable');

    expect(result).toEqual({
      twoFactorRequired: true,
      challengeToken: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresInSeconds: 600,
    });
    expect(code).toMatch(/^\d{6}$/);
    expect(user.twoFactorChallengeTokenHash).not.toContain(result.challengeToken);
    expect(user.twoFactorChallengeCodeHash).not.toContain(code);
    expect(user.twoFactorChallengePurpose).toBe('enable');
    expect(user.twoFactorChallengeExpires!.getTime()).toBeGreaterThan(Date.now());
    expect(emailService.sendTwoFactorCodeEmail).toHaveBeenCalledWith(user.email, code, 10);
  });

  it.each([
    [{ emailVerified: false }, 'Verify your email'],
    [{ authProvider: 'google', passwordHash: null }, 'password accounts only'],
  ])('rejects ineligible setup accounts', async (overrides, message) => {
    await expect(
      service.startChallenge(createUser(overrides as Partial<User>), 'enable'),
    ).rejects.toThrow(message);
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('rejects setup when email delivery is unavailable', async () => {
    emailService.isConfigured.mockReturnValue(false);

    await expect(service.startChallenge(createUser(), 'enable')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('clears a stored challenge when sending the email fails', async () => {
    emailService.sendTwoFactorCodeEmail.mockRejectedValue(new Error('SMTP unavailable'));

    await expect(service.startChallenge(createUser(), 'enable')).rejects.toThrow(
      'Unable to send the verification code.',
    );
    expect(userRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7 }),
      expect.objectContaining({ twoFactorChallengeTokenHash: null }),
    );
  });

  it('consumes a valid login challenge exactly once', async () => {
    const user = createUser({ twoFactorEnabled: true });
    const { result, code } = await issueChallenge(user, 'login');
    const tokenHash = user.twoFactorChallengeTokenHash;
    userRepository.findOne.mockResolvedValue(user);

    await expect(
      service.consumeLogin({ challengeToken: result.challengeToken, code }),
    ).resolves.toBe(user);
    expect(userRepository.update).toHaveBeenCalledWith(
      { id: user.id, twoFactorChallengeTokenHash: tokenHash },
      expect.objectContaining({ twoFactorChallengeCodeHash: null }),
    );

    await expect(
      service.consumeLogin({ challengeToken: result.challengeToken, code }),
    ).rejects.toThrow('Invalid or expired two-factor challenge.');
  });

  it('rejects a challenge won by a concurrent consumer', async () => {
    const user = createUser({ twoFactorEnabled: true });
    const { result, code } = await issueChallenge(user, 'login');
    userRepository.findOne.mockResolvedValue(user);
    userRepository.update.mockResolvedValue({ affected: 0 });

    await expect(
      service.consumeLogin({ challengeToken: result.challengeToken, code }),
    ).rejects.toThrow('already been used');
  });

  it('rejects an incorrect or expired login code', async () => {
    const user = createUser({ twoFactorEnabled: true });
    const { result } = await issueChallenge(user, 'login');
    userRepository.findOne.mockResolvedValueOnce(user);

    await expect(
      service.consumeLogin({ challengeToken: result.challengeToken, code: '000000' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(userRepository.update).not.toHaveBeenCalled();

    userRepository.findOne.mockResolvedValueOnce(null);
    await expect(
      service.consumeLogin({ challengeToken: result.challengeToken, code: '000000' }),
    ).rejects.toThrow('Invalid or expired two-factor challenge.');
  });

  it('enables two-factor only for the owner of the setup challenge', async () => {
    const user = createUser();
    const { result, code } = await issueChallenge(user, 'enable');
    userRepository.findOne.mockImplementation(({ where }: any) =>
      Promise.resolve(where.id === user.id ? user : null),
    );

    await expect(
      service.enable(user.id + 1, { challengeToken: result.challengeToken, code }),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.enable(user.id, { challengeToken: result.challengeToken, code }),
    ).resolves.toEqual({ success: true });
    expect(user.twoFactorEnabled).toBe(true);
    expect(user.twoFactorChallengeTokenHash).toBeNull();
    expect(user.twoFactorChallengeCodeHash).toBeNull();
    expect(userRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ twoFactorEnabled: true, twoFactorChallengeTokenHash: null }),
    );
    await expect(
      service.enable(user.id, { challengeToken: result.challengeToken, code }),
    ).rejects.toThrow('Invalid or expired two-factor challenge.');
  });

  it('requires the current password to disable two-factor authentication', async () => {
    const user = createUser({ twoFactorEnabled: true });
    userRepository.findOne.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(service.disable(user.id, 'wrong')).rejects.toThrow(UnauthorizedException);
    await expect(service.disable(user.id, 'correct')).resolves.toEqual({ success: true });
    expect(user.twoFactorEnabled).toBe(false);
    expect(user.twoFactorChallengeCodeHash).toBeNull();
  });

  it('reports status and eligibility for the authenticated account', async () => {
    userRepository.findOne.mockResolvedValue(createUser({ twoFactorEnabled: true }));

    await expect(service.status(7)).resolves.toEqual({
      enabled: true,
      available: true,
      emailVerified: true,
    });
  });
});
