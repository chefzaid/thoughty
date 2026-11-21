import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { ACCESS_TOKEN_SCOPES, PersonalAccessToken, type AccessTokenScope } from '@/database/entities';
import {
  ACCESS_TOKEN_LIMIT,
  PersonalAccessTokenListResponseDto,
  PersonalAccessTokenDto,
  CreatePersonalAccessTokenDto,
  CreatedPersonalAccessTokenResponseDto,
} from './dto';
import { accessTokenHashOf, accessTokenHint, createAccessToken, hashAccessToken } from './access-token-secret';

/** Namespace of the advisory lock that serializes one writer's new tokens, so the limit holds under concurrent requests. */
const ACCESS_TOKEN_LOCK_NAMESPACE = 'personal_access_tokens';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Who a valid token acts for on the public API, and what it may do there. */
export interface AuthenticatedAccessToken {
  tokenId: number;
  userId: number;
  email: string;
  username: string;
  scopes: AccessTokenScope[];
  timeZone: string;
}

interface AuthenticatedRow {
  id: number;
  user_id: number;
  email: string;
  username: string;
  scopes: AccessTokenScope[];
  time_zone: string;
}

/** A token as its writer sees it, without the token itself. */
export function toAccessTokenResponse(token: PersonalAccessToken): PersonalAccessTokenDto {
  return {
    id: token.id,
    name: token.name,
    hint: token.tokenHint,
    scopes: token.scopes,
    expiresAt: token.expiresAt,
    lastUsedAt: token.lastUsedAt,
    createdAt: token.createdAt,
  };
}

/**
 * The writer's personal access tokens for the public API: making one (shown once), listing those that
 * have not expired, revoking one (which deletes it), and checking the token a public API request sends.
 * Expired tokens are deleted as the writer next makes or lists tokens, and refused before that.
 */
@Injectable()
export class AccessTokensService {
  constructor(
    @InjectRepository(PersonalAccessToken)
    private readonly tokenRepository: Repository<PersonalAccessToken>,
  ) {}

  async list(userId: number): Promise<PersonalAccessTokenListResponseDto> {
    await this.deleteExpired(this.tokenRepository, userId);
    const tokens = await this.tokenRepository.find({ where: { userId }, order: { createdAt: 'DESC', id: 'DESC' } });
    return { tokens: tokens.map(toAccessTokenResponse), limit: ACCESS_TOKEN_LIMIT };
  }

  async create(userId: number, dto: CreatePersonalAccessTokenDto, now = new Date()): Promise<CreatedPersonalAccessTokenResponseDto> {
    const token = createAccessToken();
    const saved = await this.tokenRepository.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [ACCESS_TOKEN_LOCK_NAMESPACE, userId]);
      const repository = manager.getRepository(PersonalAccessToken);
      await this.deleteExpired(repository, userId);
      if ((await repository.count({ where: { userId } })) >= ACCESS_TOKEN_LIMIT) {
        throw apiError(BadRequestException, 'ACCESS_TOKEN_LIMIT_REACHED', `Access token limit reached (${ACCESS_TOKEN_LIMIT})`);
      }
      return repository.save(repository.create({
        userId,
        name: dto.name,
        tokenHash: hashAccessToken(token),
        tokenHint: accessTokenHint(token),
        scopes: ACCESS_TOKEN_SCOPES.filter((scope) => dto.scopes.includes(scope)),
        timeZone: dto.timeZone,
        expiresAt: dto.expiresInDays === null ? null : new Date(now.getTime() + dto.expiresInDays * DAY_MS),
        lastUsedAt: null,
      }));
    });
    return { ...toAccessTokenResponse(saved), token };
  }

  /** Revokes a token by deleting it: it then reads like one that never existed. */
  async revoke(userId: number, id: number): Promise<{ success: boolean }> {
    const result = await this.tokenRepository.delete({ id, userId });
    if (!result.affected) {
      throw apiError(NotFoundException, 'ACCESS_TOKEN_NOT_FOUND');
    }
    return { success: true };
  }

  /**
   * The writer and scopes of a token sent to the public API, or null when it is not one this API made,
   * was revoked, has expired, or belongs to an account being deleted. Marks it used, once a minute at most.
   */
  async authenticate(token: string): Promise<AuthenticatedAccessToken | null> {
    const tokenHash = accessTokenHashOf(token);
    if (!tokenHash) return null;
    const [row] = (await this.tokenRepository.query(
      `SELECT token.id, token.user_id, token.scopes, token.time_zone, account.email, account.username
         FROM personal_access_tokens token
         JOIN users account ON account.id = token.user_id
        WHERE token.token_hash = $1
          AND (token.expires_at IS NULL OR token.expires_at > now())
          AND account.deleted_at IS NULL`,
      [tokenHash],
    )) as AuthenticatedRow[];
    if (!row) return null;
    await this.tokenRepository.query(
      `UPDATE personal_access_tokens SET last_used_at = now()
        WHERE id = $1 AND (last_used_at IS NULL OR last_used_at < now() - interval '1 minute')`,
      [row.id],
    );
    return {
      tokenId: row.id,
      userId: row.user_id,
      email: row.email,
      username: row.username,
      scopes: row.scopes,
      timeZone: row.time_zone,
    };
  }

  private async deleteExpired(repository: Repository<PersonalAccessToken>, userId: number): Promise<void> {
    await repository
      .createQueryBuilder()
      .delete()
      .where('user_id = :userId', { userId })
      .andWhere('expires_at <= now()')
      .execute();
  }
}
