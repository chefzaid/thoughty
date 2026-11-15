import { ConflictException, ForbiddenException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { Diary, RefreshToken, SignUpRequest, User } from '@/database/entities';
import { ProviderAccountService, type ProviderIdentity } from './provider-account.service';
import { uniqueViolationOf } from './free-username';

const GOOGLE: ProviderIdentity = {
  provider: 'google',
  subject: 'google-sub',
  email: 'victim@example.com',
  suggestedUsername: 'Jane Doe',
  avatarUrl: 'https://lh3.googleusercontent.com/jane',
};

/** An account registered with a password; `emailVerified` says whether its address was proven. */
const account = (overrides: Partial<User> = {}): User =>
  ({
    id: 7,
    username: 'registrant',
    email: 'victim@example.com',
    passwordHash: '$2b$12$registrant',
    authProvider: 'local',
    providerId: null,
    avatarUrl: null,
    emailVerified: false,
    emailVerificationToken: 'verify-hash',
    emailVerificationTokenExpires: new Date(),
    resetToken: 'reset-hash',
    resetTokenExpires: new Date(),
    twoFactorEnabled: true,
    twoFactorChallengeTokenHash: 'challenge',
    twoFactorChallengeCodeHash: 'code',
    twoFactorChallengePurpose: 'login',
    twoFactorChallengeExpires: new Date(),
    deletedAt: null,
    ...overrides,
  }) as User;

const uniqueViolation = (constraint: string) =>
  Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505', constraint });

describe('ProviderAccountService', () => {
  let users: { findOne: jest.Mock; save: jest.Mock; exists: jest.Mock };
  let manager: { create: jest.Mock; save: jest.Mock; delete: jest.Mock; createQueryBuilder: jest.Mock };
  let deleteQuery: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock };
  let service: ProviderAccountService;

  beforeEach(() => {
    users = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (user: User) => user),
      exists: jest.fn().mockResolvedValue(false),
    };
    deleteQuery = {
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    manager = {
      create: jest.fn((_entity: unknown, value: object) => ({ ...value })),
      save: jest.fn(async (entity: unknown, value: object) => (entity === User ? { id: 42, ...value } : value)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => deleteQuery),
    };
    dataSource = { transaction: jest.fn((work: (m: typeof manager) => unknown) => work(manager)) };
    service = new ProviderAccountService(users as never, dataSource as never);
  });

  it('signs in the account linked to the subject, whatever its address now is', async () => {
    const linked = account({ authProvider: 'google', providerId: 'google-sub', email: 'old@example.com', emailVerified: true });
    users.findOne.mockResolvedValueOnce(linked);

    await expect(service.signIn(GOOGLE)).resolves.toEqual({ user: linked, isNewUser: false });
    expect(users.findOne).toHaveBeenCalledTimes(1);
    expect(users.findOne).toHaveBeenCalledWith({ where: { authProvider: 'google', providerId: 'google-sub' } });
    expect(users.save).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['linked to the subject', [account({ deletedAt: new Date(), emailVerified: true })]],
    ['with the address', [null, account({ deletedAt: new Date() })]],
  ])('refuses a deleted account %s', async (_case, found) => {
    for (const user of found) users.findOne.mockResolvedValueOnce(user);

    await expectApiError(service.signIn(GOOGLE), ForbiddenException, 'AUTH_ACCOUNT_DELETED');
    expect(users.save).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('links a verified account with the address and keeps its password and two-factor setting', async () => {
    users.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(account({ emailVerified: true }));

    const { user, isNewUser } = await service.signIn(GOOGLE);

    expect(isNewUser).toBe(false);
    expect(user).toMatchObject({
      authProvider: 'google',
      providerId: 'google-sub',
      avatarUrl: GOOGLE.avatarUrl,
      passwordHash: '$2b$12$registrant',
      twoFactorEnabled: true,
    });
    expect(users.findOne).toHaveBeenLastCalledWith({ where: { email: 'victim@example.com' } });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('keeps the avatar when the provider sends none', async () => {
    users.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(account({ emailVerified: true, avatarUrl: 'mine.png' }));

    const { user } = await service.signIn({ ...GOOGLE, provider: 'keycloak', avatarUrl: undefined });

    expect(user).toMatchObject({ authProvider: 'keycloak', avatarUrl: 'mine.png' });
  });

  it('takes over an unverified account with the address and drops every way in its registrant set up', async () => {
    users.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(account());

    const { user, isNewUser } = await service.signIn(GOOGLE);

    expect(isNewUser).toBe(false);
    expect(manager.save).toHaveBeenCalledWith(User, expect.objectContaining({ id: 7 }));
    expect(user).toMatchObject({
      id: 7,
      username: 'registrant',
      authProvider: 'google',
      providerId: 'google-sub',
      emailVerified: true,
      passwordHash: null,
      twoFactorEnabled: false,
      twoFactorChallengeTokenHash: null,
      twoFactorChallengeCodeHash: null,
      twoFactorChallengePurpose: null,
      twoFactorChallengeExpires: null,
      emailVerificationToken: null,
      emailVerificationTokenExpires: null,
      resetToken: null,
      resetTokenExpires: null,
    });
    expect(manager.delete).toHaveBeenCalledWith(RefreshToken, { userId: 7 });
    expect(manager.delete).toHaveBeenCalledWith(SignUpRequest, { email: 'victim@example.com' });
    expect(deleteQuery.where).toHaveBeenCalledWith('user_id = :userId', { userId: 7 });
    expect(deleteQuery.andWhere).toHaveBeenCalledWith('key LIKE :prefix', { prefix: 'cloud\\_%' });
    expect(deleteQuery.execute).toHaveBeenCalled();
    expect(users.save).not.toHaveBeenCalled();
  });

  it('takes over an unverified account even when it is already linked to the subject', async () => {
    users.findOne.mockResolvedValueOnce(account({ authProvider: 'google', providerId: 'google-sub' }));

    await expect(service.signIn(GOOGLE)).resolves.toMatchObject({ user: { passwordHash: null, emailVerified: true } });
    expect(manager.delete).toHaveBeenCalledWith(RefreshToken, { userId: 7 });
  });

  it('creates a verified account with the default diary under the suggested name when it is free', async () => {
    const { user, isNewUser } = await service.signIn(GOOGLE);

    expect(isNewUser).toBe(true);
    expect(user).toMatchObject({
      id: 42,
      username: 'Jane Doe',
      email: 'victim@example.com',
      authProvider: 'google',
      providerId: 'google-sub',
      avatarUrl: GOOGLE.avatarUrl,
      emailVerified: true,
    });
    expect(manager.save).toHaveBeenCalledWith(Diary, expect.objectContaining({ userId: 42, name: 'Thoughts', isDefault: true }));
  });

  it('gives a taken name a number', async () => {
    users.exists.mockResolvedValueOnce(true);

    const { user } = await service.signIn(GOOGLE);

    expect(user.username).toMatch(/^Jane Doe-\d{6}$/);
    expect(users.exists).toHaveBeenNthCalledWith(1, { where: { username: 'Jane Doe' } });
  });

  it.each([
    ['no name', undefined],
    ['a blank name', '   '],
    ['a name that is only markup', '<script>alert(1)</script>'],
  ])('names an account with %s after the part of the address before the @', async (_case, suggestedUsername) => {
    const { user } = await service.signIn({ ...GOOGLE, suggestedUsername, avatarUrl: undefined });

    expect(user).toMatchObject({ username: 'victim', avatarUrl: null });
  });

  it('cuts the name to 50 characters and strips markup from it', async () => {
    const { user } = await service.signIn({ ...GOOGLE, provider: 'keycloak', suggestedUsername: `<b>${'z'.repeat(60)}</b>` });

    expect(user.username).toBe('z'.repeat(50));
  });

  it('picks another name when a racing sign-in takes the free one before the insert', async () => {
    manager.save.mockRejectedValueOnce(uniqueViolation('users_username_key'));
    users.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const { user, isNewUser } = await service.signIn(GOOGLE);

    expect(isNewUser).toBe(true);
    expect(user.username).toMatch(/^Jane Doe-\d{6}$/);
    expect(dataSource.transaction).toHaveBeenCalledTimes(2);
  });

  it('signs in the account a racing sign-in of the same identity created', async () => {
    const created = account({ authProvider: 'google', providerId: 'google-sub', emailVerified: true });
    manager.save.mockRejectedValueOnce(uniqueViolation('users_email_key'));
    users.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(created);

    await expect(service.signIn(GOOGLE)).resolves.toEqual({ user: created, isNewUser: false });
  });

  it.each([
    ['users_username_key', 'AUTH_USERNAME_TAKEN'],
    ['users_email_key', 'AUTH_EMAIL_TAKEN'],
  ] as const)('answers 409 once %s keeps being taken', async (constraint, code) => {
    manager.save.mockRejectedValue(uniqueViolation(constraint));

    await expectApiError(service.signIn(GOOGLE), ConflictException, code);
    expect(dataSource.transaction).toHaveBeenCalledTimes(3);
  });

  it('passes any other failure on without retrying', async () => {
    manager.save.mockRejectedValue(new Error('connection lost'));

    await expect(service.signIn(GOOGLE)).rejects.toThrow('connection lost');
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });
});

describe('uniqueViolationOf', () => {
  it('reads the constraint of a unique violation only', () => {
    expect(uniqueViolationOf(uniqueViolation('users_email_key'))).toBe('users_email_key');
    expect(uniqueViolationOf({ code: '23505' })).toBe('');
    expect(uniqueViolationOf({ code: '22003' })).toBeUndefined();
    expect(uniqueViolationOf(null)).toBeUndefined();
  });
});
