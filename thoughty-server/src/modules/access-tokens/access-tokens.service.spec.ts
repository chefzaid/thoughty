import { BadRequestException, NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import type { PersonalAccessToken } from '@/database/entities';
import { ACCESS_TOKEN_LIMIT, type CreatePersonalAccessTokenDto } from './dto';
import { createAccessToken, hashAccessToken } from './access-token-secret';
import { AccessTokensService, toAccessTokenResponse } from './access-tokens.service';

const now = new Date('2026-11-21T09:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const request = (changes: Partial<CreatePersonalAccessTokenDto> = {}): CreatePersonalAccessTokenDto => ({
  name: 'iPhone Shortcut', scopes: ['entries:write'], expiresInDays: 90, timeZone: 'Europe/Paris', ...changes,
});

describe('AccessTokensService', () => {
  let tokenRepository: Record<string, jest.Mock> & { manager?: unknown };
  let deleteBuilder: Record<string, jest.Mock>;
  let manager: { query: jest.Mock; getRepository: jest.Mock };
  let service: AccessTokensService;

  beforeEach(() => {
    deleteBuilder = {
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    tokenRepository = {
      createQueryBuilder: jest.fn(() => deleteBuilder),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 3, createdAt: now, ...value })),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
    };
    manager = { query: jest.fn().mockResolvedValue([]), getRepository: jest.fn(() => tokenRepository) };
    tokenRepository.manager = { transaction: jest.fn((work) => work(manager)) };
    service = new AccessTokensService(tokenRepository as never);
  });

  it('makes a prefixed token under the writer’s lock, keeping only its hash and hint', async () => {
    const created = await service.create(5, request({ scopes: ['entries:write', 'entries:read'] }), now);

    expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1), $2)', ['personal_access_tokens', 5]);
    expect(deleteBuilder.andWhere).toHaveBeenCalledWith('expires_at <= now()');
    const saved = tokenRepository.save.mock.calls[0][0] as PersonalAccessToken;
    expect(saved).toEqual(expect.objectContaining({
      userId: 5,
      name: 'iPhone Shortcut',
      scopes: ['entries:read', 'entries:write'],
      timeZone: 'Europe/Paris',
      expiresAt: new Date(now.getTime() + 90 * DAY_MS),
      lastUsedAt: null,
    }));
    expect(created.token).toMatch(/^thy_[\w-]{43}$/);
    expect(saved.tokenHash).toBe(hashAccessToken(created.token));
    expect(saved.tokenHint).toBe(created.token.slice(0, 8));
    expect(created).toEqual(expect.objectContaining({ id: 3, hint: saved.tokenHint, scopes: ['entries:read', 'entries:write'] }));
    expect(JSON.stringify(created)).not.toContain(saved.tokenHash);
  });

  it('makes a token that never expires', async () => {
    await service.create(5, request({ expiresInDays: null }), now);

    expect(tokenRepository.save).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: null }));
  });

  it('refuses a token past the limit, counted after the expired ones are deleted', async () => {
    tokenRepository.count.mockResolvedValue(ACCESS_TOKEN_LIMIT);

    await expectApiError(service.create(5, request(), now), BadRequestException, 'ACCESS_TOKEN_LIMIT_REACHED');
    expect(deleteBuilder.execute).toHaveBeenCalled();
    expect(tokenRepository.save).not.toHaveBeenCalled();
  });

  it('lists the unexpired tokens newest first, with the limit', async () => {
    const token = {
      id: 3, userId: 5, name: 'Zapier', tokenHint: 'thy_abcd', scopes: ['entries:read'], timeZone: 'UTC',
      expiresAt: null, lastUsedAt: now, createdAt: now,
    } as PersonalAccessToken;
    tokenRepository.find.mockResolvedValue([token]);

    await expect(service.list(5)).resolves.toEqual({ tokens: [toAccessTokenResponse(token)], limit: ACCESS_TOKEN_LIMIT });
    expect(tokenRepository.find).toHaveBeenCalledWith({ where: { userId: 5 }, order: { createdAt: 'DESC', id: 'DESC' } });
    expect(deleteBuilder.where).toHaveBeenCalledWith('user_id = :userId', { userId: 5 });
    expect(toAccessTokenResponse(token)).toEqual({
      id: 3, name: 'Zapier', hint: 'thy_abcd', scopes: ['entries:read'], expiresAt: null, lastUsedAt: now, createdAt: now,
    });
  });

  it('revokes only the writer’s own token', async () => {
    tokenRepository.delete.mockResolvedValueOnce({ affected: 1 }).mockResolvedValueOnce({ affected: 0 });

    await expect(service.revoke(5, 3)).resolves.toEqual({ success: true });
    expect(tokenRepository.delete).toHaveBeenCalledWith({ id: 3, userId: 5 });
    await expectApiError(service.revoke(5, 4), NotFoundException, 'ACCESS_TOKEN_NOT_FOUND');
  });

  describe('authenticate', () => {
    it('finds an unexpired token of an account not being deleted by its hash, and marks it used', async () => {
      const token = createAccessToken();
      tokenRepository.query.mockResolvedValueOnce([{
        id: 3, user_id: 5, email: 'w@example.com', username: 'writer', scopes: ['entries:write'], time_zone: 'Asia/Tokyo',
      }]);

      await expect(service.authenticate(token)).resolves.toEqual({
        tokenId: 3, userId: 5, email: 'w@example.com', username: 'writer', scopes: ['entries:write'], timeZone: 'Asia/Tokyo',
      });
      const [select, update] = tokenRepository.query.mock.calls;
      expect(select[0]).toContain('token.expires_at IS NULL OR token.expires_at > now()');
      expect(select[0]).toContain('account.deleted_at IS NULL');
      expect(select[1]).toEqual([hashAccessToken(token)]);
      expect(update[0]).toContain("last_used_at < now() - interval '1 minute'");
      expect(update[1]).toEqual([3]);
    });

    it('answers null for an unknown token, and runs no query for one this API cannot have made', async () => {
      await expect(service.authenticate(createAccessToken())).resolves.toBeNull();
      expect(tokenRepository.query).toHaveBeenCalledTimes(1);

      await expect(service.authenticate('eyJhbGciOiJIUzI1NiJ9.e30.sig')).resolves.toBeNull();
      expect(tokenRepository.query).toHaveBeenCalledTimes(1);
    });
  });
});
