import {
  BadRequestException,
  ConflictException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { Diary, SignUpRequest, User } from '@/database/entities';
import {
  SIGN_UP_EMAIL_INTERVAL_MS,
  SIGN_UP_EMAILS_PER_ADDRESS,
  SIGN_UP_LINK_TTL_MS,
  SignUpService,
} from './sign-up.service';
import { usernameLookup } from './auth-services.test-helpers';

jest.mock('bcryptjs', () => ({ hash: jest.fn(), compare: jest.fn() }));

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const flush = () => new Promise((resolve) => setImmediate(resolve));
const STARTED = { verificationRequired: true, message: 'Check your email to finish creating your account.' };
const DTO = { email: 'New@Example.com', password: 'Pass123!@', username: 'newbie', website: '' };

describe('SignUpService', () => {
  const originalEnv = process.env.NODE_ENV;
  let requests: { findOne: jest.Mock; upsert: jest.Mock; delete: jest.Mock };
  let users: { findOne: jest.Mock; exists: jest.Mock };
  let manager: { delete: jest.Mock; create: jest.Mock; save: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let authService: { register: jest.Mock };
  let sessions: { createSession: jest.Mock };
  let email: {
    isConfigured: jest.Mock;
    sendSignUpLinkEmail: jest.Mock;
    sendSignUpNoticeEmail: jest.Mock;
  };

  const createService = () =>
    new SignUpService(
      requests as never,
      users as never,
      dataSource as never,
      authService as never,
      sessions as never,
      email as never,
      { get: jest.fn((_key: string, fallback: string) => fallback) } as never,
    );

  beforeEach(() => {
    requests = { findOne: jest.fn().mockResolvedValue(null), upsert: jest.fn(), delete: jest.fn() };
    users = { findOne: jest.fn().mockResolvedValue(null), exists: jest.fn().mockResolvedValue(false) };
    manager = {
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((_entity: unknown, fields: object) => ({ ...fields })),
      save: jest.fn(async (_entity: unknown, row: object) => ({ id: 7, ...row })),
    };
    dataSource = { transaction: jest.fn(async (work: (m: typeof manager) => unknown) => work(manager)) };
    authService = { register: jest.fn() };
    sessions = { createSession: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r', user: { id: 7 } }) };
    email = {
      isConfigured: jest.fn().mockReturnValue(true),
      sendSignUpLinkEmail: jest.fn().mockResolvedValue(undefined),
      sendSignUpNoticeEmail: jest.fn().mockResolvedValue(undefined),
    };
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  describe('register', () => {
    it('refuses a filled bot trap before anything else', async () => {
      await expect(createService().register({ ...DTO, website: 'spam' })).rejects.toBeInstanceOf(BadRequestException);
      expect(users.findOne).not.toHaveBeenCalled();
    });

    it('signs in at once outside production when no mail server is configured', async () => {
      email.isConfigured.mockReturnValue(false);
      process.env.NODE_ENV = 'development';
      authService.register.mockResolvedValue({ accessToken: 'a' });

      await expect(createService().register(DTO)).resolves.toEqual({ accessToken: 'a' });
      expect(authService.register).toHaveBeenCalledWith(DTO);
    });

    it('refuses every sign-up in production when no mail server is configured', async () => {
      email.isConfigured.mockReturnValue(false);
      process.env.NODE_ENV = 'production';

      await expect(createService().register(DTO)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(authService.register).not.toHaveBeenCalled();
    });

    it('emails a new address a single-use link and stores only hashes of the token and password', async () => {
      const before = Date.now();
      await expect(createService().register(DTO)).resolves.toEqual(STARTED);
      await flush();

      const [row, conflict] = requests.upsert.mock.calls[0] as [Partial<SignUpRequest>, string[]];
      expect(conflict).toEqual(['email']);
      expect(row).toMatchObject({
        email: 'new@example.com',
        passwordHash: 'hashed-password',
        username: 'newbie',
        sentCount: 1,
      });
      expect(row.expiresAt!.getTime()).toBeGreaterThanOrEqual(before + SIGN_UP_LINK_TTL_MS);
      const [to, url] = email.sendSignUpLinkEmail.mock.calls[0] as [string, string];
      expect(to).toBe('new@example.com');
      const token = new URL(url).searchParams.get('token')!;
      expect(url).toBe(`http://localhost:5173/complete-sign-up?token=${token}`);
      expect(row.tokenHash).toBe(sha256(token));
      expect(email.sendSignUpNoticeEmail).not.toHaveBeenCalled();
    });

    it('keeps no username when none was asked for', async () => {
      await createService().register({ email: 'x@example.com', password: 'Pass123!@' });

      expect(requests.upsert.mock.calls[0][0]).toMatchObject({ username: null });
    });

    it('answers an address that has an account the same way, after the same work, and emails a notice', async () => {
      users.findOne.mockResolvedValue({ id: 3, deletedAt: null });

      await expect(createService().register(DTO)).resolves.toEqual(STARTED);
      await flush();

      expect(bcrypt.hash).toHaveBeenCalledWith(DTO.password, 12);
      expect(requests.upsert.mock.calls[0][0]).toMatchObject({
        email: 'new@example.com',
        tokenHash: null,
        passwordHash: null,
        username: null,
      });
      expect(email.sendSignUpNoticeEmail).toHaveBeenCalledWith('new@example.com', 'http://localhost:5173/login');
      expect(email.sendSignUpLinkEmail).not.toHaveBeenCalled();
    });

    it('sends nothing to a deleted account waiting for its purge, and still answers the same', async () => {
      users.findOne.mockResolvedValue({ id: 3, deletedAt: new Date() });

      await expect(createService().register(DTO)).resolves.toEqual(STARTED);
      await flush();

      expect(requests.upsert).toHaveBeenCalled();
      expect(email.sendSignUpNoticeEmail).not.toHaveBeenCalled();
    });

    it('waits a minute between emails to one address, and changes nothing meanwhile', async () => {
      requests.findOne.mockResolvedValue({
        sentCount: 1,
        lastSentAt: new Date(Date.now() - SIGN_UP_EMAIL_INTERVAL_MS / 2),
        expiresAt: new Date(Date.now() + SIGN_UP_LINK_TTL_MS),
      });

      await expect(createService().register(DTO)).resolves.toEqual(STARTED);
      await flush();

      expect(requests.upsert).not.toHaveBeenCalled();
      expect(email.sendSignUpLinkEmail).not.toHaveBeenCalled();
    });

    it('sends a new link after the interval and counts it', async () => {
      requests.findOne.mockResolvedValue({
        sentCount: 2,
        lastSentAt: new Date(Date.now() - SIGN_UP_EMAIL_INTERVAL_MS),
        expiresAt: new Date(Date.now() + SIGN_UP_LINK_TTL_MS),
      });

      await createService().register(DTO);

      expect(requests.upsert.mock.calls[0][0]).toMatchObject({ sentCount: 3 });
      expect(email.sendSignUpLinkEmail).toHaveBeenCalledTimes(1);
    });

    it('stops emailing an address that reached the cap until its request expires', async () => {
      requests.findOne.mockResolvedValue({
        sentCount: SIGN_UP_EMAILS_PER_ADDRESS,
        lastSentAt: new Date(Date.now() - 2 * SIGN_UP_EMAIL_INTERVAL_MS),
        expiresAt: new Date(Date.now() + 1000),
      });

      await createService().register(DTO);

      expect(requests.upsert).not.toHaveBeenCalled();
    });

    it('starts counting again once the request expired', async () => {
      requests.findOne.mockResolvedValue({
        sentCount: SIGN_UP_EMAILS_PER_ADDRESS,
        lastSentAt: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() - 1),
      });

      await createService().register(DTO);

      expect(requests.upsert.mock.calls[0][0]).toMatchObject({ sentCount: 1 });
    });

    it('logs a failed send without the address or the link', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      email.sendSignUpLinkEmail.mockRejectedValue(Object.assign(new Error('550 new@example.com rejected'), { responseCode: 550 }));

      await expect(createService().register(DTO)).resolves.toEqual(STARTED);
      await flush();

      expect(warn).toHaveBeenCalledWith('Sign-up link email not sent: Error 550');
    });

    it('lets the link in flight go out before shutting down', async () => {
      let finishSending!: () => void;
      email.sendSignUpLinkEmail.mockReturnValue(new Promise<void>((resolve) => (finishSending = resolve)));
      const service = createService();
      await service.register(DTO);

      let settled = false;
      const shutdown = service.beforeApplicationShutdown().then(() => (settled = true));
      await flush();
      expect(email.sendSignUpLinkEmail).toHaveBeenCalledTimes(1);
      expect(settled).toBe(false);

      finishSending();
      await shutdown;
      expect(settled).toBe(true);
    });

    it('logs a failed notice the same way', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      users.findOne.mockResolvedValue({ id: 3, deletedAt: null });
      email.sendSignUpNoticeEmail.mockRejectedValue('down');

      await createService().register(DTO);
      await flush();

      expect(warn).toHaveBeenCalledWith('Sign-up notice email not sent: unknown error');
    });
  });

  describe('complete', () => {
    const pending = {
      id: 5,
      email: 'new@example.com',
      tokenHash: sha256('link-token'),
      passwordHash: 'stored-hash',
      username: 'newbie',
    };

    beforeEach(() => {
      requests.findOne.mockResolvedValue({ ...pending });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    });

    it('creates the verified account with its default diary, uses the link once and signs in', async () => {
      await expect(createService().complete({ token: 'link-token', password: 'Pass123!@' })).resolves.toEqual({
        accessToken: 'a',
        refreshToken: 'r',
        user: { id: 7 },
      });

      expect(requests.findOne.mock.calls[0][0].where.tokenHash).toBe(sha256('link-token'));
      expect(bcrypt.compare).toHaveBeenCalledWith('Pass123!@', 'stored-hash');
      expect(manager.delete).toHaveBeenCalledWith(SignUpRequest, { id: 5, tokenHash: pending.tokenHash });
      expect(manager.save).toHaveBeenNthCalledWith(1, User, {
        username: 'newbie',
        email: 'new@example.com',
        passwordHash: 'stored-hash',
        authProvider: 'local',
        emailVerified: true,
      });
      expect(manager.save).toHaveBeenNthCalledWith(2, Diary, expect.objectContaining({ userId: 7, name: 'Thoughts', isDefault: true }));
      expect(sessions.createSession).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), true);
    });

    it('refuses an unknown, expired or used link', async () => {
      requests.findOne.mockResolvedValue(null);

      await expect(createService().complete({ token: 'nope', password: 'x' })).rejects.toMatchObject({
        response: { code: 'AUTH_INVALID_SIGN_UP_TOKEN' },
      });
    });

    it('refuses a row without a token, which only spaces out notices', async () => {
      requests.findOne.mockResolvedValue({ ...pending, passwordHash: null });

      await expect(createService().complete({ token: 'x', password: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses another password than the one chosen, and keeps the link', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(createService().complete({ token: 'link-token', password: 'Other123!' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(requests.delete).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('drops the request when the address got an account in the meantime', async () => {
      users.exists.mockResolvedValueOnce(true);

      await expect(createService().complete({ token: 'link-token', password: 'Pass123!@' })).rejects.toMatchObject({
        response: { code: 'AUTH_EMAIL_TAKEN' },
      });
      expect(requests.delete).toHaveBeenCalledWith({ id: 5 });
    });

    it('asks for another username when the chosen one is taken, and keeps the link', async () => {
      users.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      await expect(createService().complete({ token: 'link-token', password: 'Pass123!@' })).rejects.toMatchObject({
        response: { code: 'AUTH_USERNAME_TAKEN' },
      });
      expect(usernameLookup(users.exists.mock.calls.at(-1))).toEqual({ type: 'raw', username: 'newbie' });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('uses the username sent with the link over the one asked for at sign-up', async () => {
      await createService().complete({ token: 'link-token', password: 'Pass123!@', username: 'other' });

      expect(manager.save.mock.calls[0][1]).toMatchObject({ username: 'other' });
    });

    it('takes the part of the address before the @ when no username was asked for', async () => {
      requests.findOne.mockResolvedValue({ ...pending, username: null });

      await createService().complete({ token: 'link-token', password: 'Pass123!@' });

      expect(manager.save.mock.calls[0][1]).toMatchObject({ username: 'new' });
    });

    it('adds a number to that name when it is taken', async () => {
      requests.findOne.mockResolvedValue({ ...pending, username: null });
      users.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      await createService().complete({ token: 'link-token', password: 'Pass123!@' });

      expect(manager.save.mock.calls[0][1].username).toMatch(/^new-\d{6}$/);
    });

    it('asks for a username when no free one is found from the address', async () => {
      requests.findOne.mockResolvedValue({ ...pending, username: null });
      users.exists.mockResolvedValueOnce(false).mockResolvedValue(true);

      await expect(createService().complete({ token: 'link-token', password: 'Pass123!@' })).rejects.toMatchObject({
        response: { code: 'AUTH_USERNAME_TAKEN' },
      });
    });

    it('refuses the link when another request used it first', async () => {
      manager.delete.mockResolvedValue({ affected: 0 });

      await expect(createService().complete({ token: 'link-token', password: 'Pass123!@' })).rejects.toMatchObject({
        response: { code: 'AUTH_INVALID_SIGN_UP_TOKEN' },
      });
      expect(manager.save).not.toHaveBeenCalled();
    });

    it.each([
      ['users_username_key', 'AUTH_USERNAME_TAKEN'],
      ['users_email_key', 'AUTH_EMAIL_TAKEN'],
    ])('answers a %s race with %s', async (constraint, code) => {
      manager.save.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505', constraint }));

      await expect(createService().complete({ token: 'link-token', password: 'Pass123!@' })).rejects.toMatchObject({
        response: { code },
      });
    });

    it('passes on any other failure', async () => {
      manager.save.mockRejectedValueOnce(new Error('database down'));

      const failure = createService().complete({ token: 'link-token', password: 'Pass123!@' });
      await expect(failure).rejects.toThrow('database down');
      await expect(failure).rejects.not.toBeInstanceOf(ConflictException);
    });
  });
});
