import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { Diary, Setting, User } from '@/database/entities';
import { AuthService } from './auth.service';
import { hashRefreshToken } from './auth-session.service';
import {
  createAuthServiceMocks,
  createAuthServices,
  mockRefreshToken,
  mockUser,
  type AuthServiceMocks,
  usernameLookup,
} from './auth-services.test-helpers';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

const uniqueViolation = (constraint: string) =>
  Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505', constraint });

describe('AuthService.register', () => {
  let service: AuthService;
  let mocks: AuthServiceMocks;

  beforeEach(async () => {
    mocks = createAuthServiceMocks();
    mocks.userRepository.save.mockImplementation(async (user: object) => ({ ...mockUser, ...user, id: 1 }));
    mocks.diaryRepository.save.mockImplementation(async (diary: object) => ({ id: 1, ...diary }));
    mocks.refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);
    ({ auth: service } = await createAuthServices(mocks));
  });

  afterEach(() => jest.clearAllMocks());

  it('creates the account and its default diary in one transaction and signs the writer in', async () => {
    const result = await service.register({
      email: 'Test@Example.com',
      password: 'Password123!',
      username: ' testuser ',
    });

    expect(mocks.userRepository.exists).toHaveBeenNthCalledWith(1, { where: { email: 'test@example.com' } });
    expect(usernameLookup(mocks.userRepository.exists.mock.calls[1])).toEqual({ type: 'raw', username: 'testuser' });
    expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 12);
    expect(mocks.dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.manager.save).toHaveBeenNthCalledWith(1, User, {
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hashed_password',
      authProvider: 'local',
      emailVerified: false,
    });
    expect(mocks.manager.save).toHaveBeenNthCalledWith(
      2,
      Diary,
      expect.objectContaining({ userId: 1, name: 'Thoughts', icon: '💭', color: '#E76F51', isDefault: true }),
    );
    expect('user' in result && result.user.email).toBe('test@example.com');
    expect(mocks.refreshTokenRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, tokenHash: hashRefreshToken(result.refreshToken) }),
    );
  });

  it('starts the account in the language and theme the visitor sent, and in the defaults without them', async () => {
    await service.register({ email: 'fr@example.com', password: 'Password123!', language: 'fr', theme: 'light' });

    expect(mocks.manager.save).toHaveBeenNthCalledWith(3, Setting, [
      { userId: 1, key: 'language', value: 'fr' },
      { userId: 1, key: 'theme', value: 'light' },
    ]);

    mocks.manager.save.mockClear();
    await service.register({ email: 'en@example.com', password: 'Password123!' });

    expect(mocks.manager.save.mock.calls.map(([entity]) => entity)).toEqual([User, Diary]);
  });

  it('refuses an address that already has an account before any other work', async () => {
    mocks.userRepository.exists.mockResolvedValueOnce(true);

    await expectApiError(
      service.register({ email: 'test@example.com', password: 'Password123!', username: 'new' }),
      ConflictException,
      'AUTH_EMAIL_TAKEN',
    );
    expect(mocks.userRepository.exists).toHaveBeenCalledTimes(1);
    expect(mocks.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('refuses a username another account has in any case', async () => {
    mocks.userRepository.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expectApiError(
      service.register({ email: 'new@example.com', password: 'Password123!', username: 'Jane' }),
      ConflictException,
      'AUTH_USERNAME_TAKEN',
    );
    expect(usernameLookup(mocks.userRepository.exists.mock.calls[1])).toEqual({ type: 'raw', username: 'Jane' });
    expect(mocks.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('names an account without a chosen username after its address, numbered when that is taken', async () => {
    await service.register({ email: 'newuser@example.com', password: 'Password123!' });
    expect(mocks.manager.save.mock.calls[0][1]).toMatchObject({ username: 'newuser' });

    mocks.manager.save.mockClear();
    mocks.userRepository.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await service.register({ email: 'newuser@example.com', password: 'Password123!' });
    expect(mocks.manager.save.mock.calls[0][1].username).toMatch(/^newuser-\d{6}$/);
  });

  it.each([
    ['uq_users_username_lower', 'AUTH_USERNAME_TAKEN'],
    ['users_email_key', 'AUTH_EMAIL_TAKEN'],
  ] as const)('answers 409 when a racing registration takes the %s first', async (constraint, code) => {
    mocks.manager.save.mockRejectedValueOnce(uniqueViolation(constraint));

    await expectApiError(
      service.register({ email: 'race@example.com', password: 'Password123!', username: 'race' }),
      ConflictException,
      code,
    );
    expect(mocks.refreshTokenRepository.save).not.toHaveBeenCalled();
  });

  it('passes any other database error on', async () => {
    const failure = new Error('connection lost');
    mocks.manager.save.mockRejectedValueOnce(failure);

    await expect(
      service.register({ email: 'race@example.com', password: 'Password123!', username: 'race' }),
    ).rejects.toBe(failure);
  });
});

describe('AuthService.login lookup', () => {
  it('matches the address or the username ignoring case and prefers an address match', async () => {
    const mocks = createAuthServiceMocks();
    const builder = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    mocks.userRepository.createQueryBuilder.mockReturnValue(builder);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const { auth } = await createAuthServices(mocks);

    await auth.login({ identifier: ' Jane Doe ', password: 'Password123!' }).catch(() => undefined);

    expect(builder.where).toHaveBeenCalledWith(
      'LOWER(user.email) = LOWER(:identifier) OR LOWER(user.username) = LOWER(:identifier)',
      { identifier: 'Jane Doe' },
    );
    expect(builder.orderBy).toHaveBeenCalledWith('CASE WHEN LOWER(user.email) = LOWER(:identifier) THEN 0 ELSE 1 END');
  });
});
