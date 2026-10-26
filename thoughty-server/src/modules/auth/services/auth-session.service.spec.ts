import {
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuthSessionService } from './auth-session.service';
import { hashRefreshToken } from './auth-session.service';
import {
  createAuthServiceMocks,
  createAuthServices,
  mockRefreshToken,
  mockUser,
} from './auth-services.test-helpers';

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

describe('AuthSessionService', () => {
  let service: AuthSessionService;
  let userRepository: any;
  let refreshTokenRepository: any;
  let jwtService: any;

  beforeEach(async () => {
    const mocks = createAuthServiceMocks();
    ({ userRepository, refreshTokenRepository, jwtService } = mocks);
    ({ sessions: service } = await createAuthServices(mocks));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('refreshToken', () => {
    const claimRows = (rows: Array<{ user_id: number }>) => {
      const builder = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ raw: rows, affected: rows.length }),
      };
      refreshTokenRepository.createQueryBuilder.mockReturnValue(builder);
      return builder;
    };

    it('rotates the refresh token: deletes the presented one and issues a new pair', async () => {
      jwtService.verify.mockReturnValue({ userId: 1 });
      jwtService.sign.mockReturnValueOnce('new_access').mockReturnValueOnce('new_refresh');
      const builder = claimRows([{ user_id: 1 }]);
      userRepository.findOne.mockResolvedValue(mockUser);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await service.refreshToken('valid_refresh_token');

      expect(result).toEqual({ accessToken: 'new_access', refreshToken: 'new_refresh' });
      expect(builder.where).toHaveBeenCalledWith('token_hash = :tokenHash', {
        tokenHash: hashRefreshToken('valid_refresh_token'),
      });
      expect(builder.returning).toHaveBeenCalledWith('user_id');
      expect(refreshTokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, tokenHash: hashRefreshToken('new_refresh') }),
      );
      expect(jwtService.sign).toHaveBeenLastCalledWith(
        { userId: 1, jti: expect.any(String) },
        expect.objectContaining({ expiresIn: '7d' }),
      );
    });

    it('rejects a refresh token that was already used', async () => {
      jwtService.verify.mockReturnValue({ userId: 1 });
      claimRows([{ user_id: 1 }]);
      userRepository.findOne.mockResolvedValue(mockUser);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);
      await service.refreshToken('valid_refresh_token');

      claimRows([]);
      await expect(service.refreshToken('valid_refresh_token')).rejects.toThrow(
        'Refresh token expired or revoked',
      );
      expect(refreshTokenRepository.save).toHaveBeenCalledTimes(1);
    });

    it('rejects a missing refresh token', async () => {
      await expect(service.refreshToken(undefined)).rejects.toThrow(UnauthorizedException);
      expect(refreshTokenRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken('invalid_token')).rejects.toThrow(UnauthorizedException);
      expect(refreshTokenRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for expired/revoked token', async () => {
      jwtService.verify.mockReturnValue({ userId: 1 });
      claimRows([]);

      await expect(service.refreshToken('expired_token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException for deleted user token', async () => {
      jwtService.verify.mockReturnValue({ userId: 1 });
      claimRows([{ user_id: 1 }]);
      userRepository.findOne.mockResolvedValue({ ...mockUser, deletedAt: new Date() });

      await expect(service.refreshToken('valid_token')).rejects.toThrow(ForbiddenException);
      expect(refreshTokenRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should logout successfully with refresh token', async () => {
      refreshTokenRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.logout('refresh_token');

      expect(result).toEqual({ success: true });
      expect(refreshTokenRepository.delete).toHaveBeenCalledWith({
        tokenHash: hashRefreshToken('refresh_token'),
      });
    });

    it('should logout successfully without refresh token', async () => {
      const result = await service.logout();

      expect(result).toEqual({ success: true });
      expect(refreshTokenRepository.delete).not.toHaveBeenCalled();
    });
  });

  it('lists active sessions without exposing token values', async () => {
    const olderSession = {
      id: 1,
      userId: 1,
      tokenHash: hashRefreshToken('old_refresh_token'),
      createdAt: new Date('2026-06-20T10:00:00.000Z'),
      expiresAt: new Date('2026-06-27T10:00:00.000Z'),
    };
    const currentSession = {
      id: 2,
      userId: 1,
      tokenHash: hashRefreshToken('current_refresh_token'),
      createdAt: new Date('2026-06-21T10:00:00.000Z'),
      expiresAt: new Date('2026-06-28T10:00:00.000Z'),
    };
    refreshTokenRepository.find.mockResolvedValue([currentSession, olderSession]);

    const result = await service.listSessions(1, 'current_refresh_token');

    expect(refreshTokenRepository.find).toHaveBeenCalledWith({
      where: { userId: 1, expiresAt: expect.any(Object) },
      order: { createdAt: 'DESC' },
    });
    expect(result).toEqual([
      {
        id: 2,
        current: true,
        createdAt: currentSession.createdAt,
        expiresAt: currentSession.expiresAt,
      },
      {
        id: 1,
        current: false,
        createdAt: olderSession.createdAt,
        expiresAt: olderSession.expiresAt,
      },
    ]);
    expect(result).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ token: expect.any(String) })]),
    );
    expect(result).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ tokenHash: expect.any(String) })]),
    );
  });

  it('marks no session current without a presented refresh token', async () => {
    refreshTokenRepository.find.mockResolvedValue([
      {
        id: 1,
        userId: 1,
        tokenHash: hashRefreshToken('a'),
        createdAt: new Date(),
        expiresAt: new Date(),
      },
    ]);

    const result = await service.listSessions(1);

    expect(result[0].current).toBe(false);
  });

  it('revokes a non-current session owned by the user', async () => {
    refreshTokenRepository.findOne.mockResolvedValue({
      id: 2,
      userId: 1,
      tokenHash: hashRefreshToken('other_refresh_token'),
    });
    refreshTokenRepository.delete.mockResolvedValue({ affected: 1 });

    const result = await service.revokeSession(1, 2, 'current_refresh_token');

    expect(result).toEqual({ success: true });
    expect(refreshTokenRepository.findOne).toHaveBeenCalledWith({ where: { id: 2, userId: 1 } });
    expect(refreshTokenRepository.delete).toHaveBeenCalledWith({ id: 2, userId: 1 });
  });

  it('does not revoke the current session through session management', async () => {
    refreshTokenRepository.findOne.mockResolvedValue({
      id: 2,
      userId: 1,
      tokenHash: hashRefreshToken('current_refresh_token'),
    });

    await expect(service.revokeSession(1, 2, 'current_refresh_token')).rejects.toThrow(
      BadRequestException,
    );
    expect(refreshTokenRepository.delete).not.toHaveBeenCalled();
  });

  it('throws when revoking a session that does not belong to the user', async () => {
    refreshTokenRepository.findOne.mockResolvedValue(null);

    await expect(service.revokeSession(1, 99, 'current_refresh_token')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('revokes all other sessions while keeping the current refresh token', async () => {
    const execute = jest.fn().mockResolvedValue({ affected: 2 });
    const andWhere = jest.fn().mockReturnValue({ execute });
    const where = jest.fn().mockReturnValue({ andWhere });
    const deleteBuilder = jest.fn().mockReturnValue({ where });
    refreshTokenRepository.createQueryBuilder.mockReturnValue({ delete: deleteBuilder });

    const result = await service.revokeOtherSessions(1, 'current_refresh_token');

    expect(result).toEqual({ success: true });
    expect(where).toHaveBeenCalledWith('user_id = :userId', { userId: 1 });
    expect(andWhere).toHaveBeenCalledWith('token_hash <> :currentTokenHash', {
      currentTokenHash: hashRefreshToken('current_refresh_token'),
    });
    expect(execute).toHaveBeenCalled();
  });

  it('requires the current refresh token before revoking other sessions', async () => {
    await expect(service.revokeOtherSessions(1)).rejects.toThrow(BadRequestException);
    expect(refreshTokenRepository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
