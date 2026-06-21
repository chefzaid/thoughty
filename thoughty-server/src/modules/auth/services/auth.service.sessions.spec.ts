import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Diary, RefreshToken, User } from '@/database/entities';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';

describe('AuthService sessions', () => {
  let service: AuthService;
  let refreshTokenRepository: any;

  beforeEach(async () => {
    refreshTokenRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshTokenRepository },
        { provide: getRepositoryToken(Diary), useValue: { save: jest.fn() } },
        { provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test-secret') } },
        {
          provide: EmailService,
          useValue: {
            sendPasswordResetEmail: jest.fn(),
            sendAccountDeletionEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lists active sessions without exposing token values', async () => {
    const olderSession = {
      id: 1,
      userId: 1,
      token: 'old_refresh_token',
      createdAt: new Date('2026-06-20T10:00:00.000Z'),
      expiresAt: new Date('2026-06-27T10:00:00.000Z'),
    };
    const currentSession = {
      id: 2,
      userId: 1,
      token: 'current_refresh_token',
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
    expect(result).not.toEqual(expect.arrayContaining([expect.objectContaining({ token: expect.any(String) })]));
  });

  it('revokes a non-current session owned by the user', async () => {
    refreshTokenRepository.findOne.mockResolvedValue({
      id: 2,
      userId: 1,
      token: 'other_refresh_token',
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
      token: 'current_refresh_token',
    });

    await expect(service.revokeSession(1, 2, 'current_refresh_token')).rejects.toThrow(BadRequestException);
    expect(refreshTokenRepository.delete).not.toHaveBeenCalled();
  });

  it('throws when revoking a session that does not belong to the user', async () => {
    refreshTokenRepository.findOne.mockResolvedValue(null);

    await expect(service.revokeSession(1, 99, 'current_refresh_token')).rejects.toThrow(NotFoundException);
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
    expect(andWhere).toHaveBeenCalledWith('token <> :currentRefreshToken', {
      currentRefreshToken: 'current_refresh_token',
    });
    expect(execute).toHaveBeenCalled();
  });

  it('requires the current refresh token before revoking other sessions', async () => {
    await expect(service.revokeOtherSessions(1)).rejects.toThrow(BadRequestException);
    expect(refreshTokenRepository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
