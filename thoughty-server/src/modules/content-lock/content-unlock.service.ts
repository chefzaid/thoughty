import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { ContentUnlock } from '@/database/entities';
import { LOCKED_ACCESS, type ContentAccess } from '@/common/content-lock';

/** The request header that carries an unlock token. */
export const CONTENT_UNLOCK_HEADER = 'x-content-unlock';

/** An unlock ends after this long without a request that carries it. */
export const CONTENT_UNLOCK_IDLE_MS = 15 * 60 * 1000;

/** 32 random bytes as 64 hex characters. */
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * The unlocks the writer's PIN gives: a random token shown once, of which only the SHA-256 is kept,
 * valid until `CONTENT_UNLOCK_IDLE_MS` passes without a request carrying it. Every request that carries
 * it moves the end on, so it lasts while the writer is active.
 */
@Injectable()
export class ContentUnlockService {
  constructor(
    @InjectRepository(ContentUnlock)
    private readonly unlockRepository: Repository<ContentUnlock>,
    private readonly dataSource: DataSource,
  ) {}

  /** A new unlock for the writer; their unlocks that already ended are cleared on the way. */
  async create(userId: number, now = new Date()): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(now.getTime() + CONTENT_UNLOCK_IDLE_MS);
    await this.unlockRepository.delete({ userId, expiresAt: LessThan(now) });
    await this.unlockRepository.insert({ userId, tokenHash: hashToken(token), expiresAt });
    return { token, expiresAt };
  }

  /**
   * What a request carrying `header` may read: the writer of the unlock while it lasts, which the
   * request extends. Read and extended on the primary, so an unlock just given is found at once.
   */
  async resolve(header: string | undefined, now = new Date()): Promise<ContentAccess> {
    if (!header || !TOKEN_PATTERN.test(header)) {
      return LOCKED_ACCESS;
    }
    const tokenHash = hashToken(header);
    const expiresAt = new Date(now.getTime() + CONTENT_UNLOCK_IDLE_MS);
    const rows: Array<{ user_id: number }> = await this.dataSource.query(
      `WITH extended AS (
         UPDATE content_unlocks SET expires_at = $2
          WHERE token_hash = $1 AND expires_at > $3
          RETURNING user_id
       )
       SELECT user_id FROM extended`,
      [tokenHash, expiresAt, now],
    );
    const userId = rows[0]?.user_id;
    return userId === undefined
      ? { ...LOCKED_ACCESS, unlockTokenHash: tokenHash }
      : { unlockedUserId: Number(userId), unlockExpiresAt: expiresAt, unlockTokenHash: tokenHash };
  }

  /** Ends the writer's unlock of that token hash (they locked again). */
  async end(userId: number, tokenHash: string | null): Promise<void> {
    if (tokenHash) {
      await this.unlockRepository.delete({ userId, tokenHash });
    }
  }

  /** Ends every unlock of the writer (their PIN changed or was removed). */
  async endAll(userId: number): Promise<void> {
    await this.unlockRepository.delete({ userId });
  }
}
