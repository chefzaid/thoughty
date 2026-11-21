import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

/** What a personal access token may do on the public API (`/api/v1`). */
export const ACCESS_TOKEN_SCOPES = ['entries:read', 'entries:write'] as const;

export type AccessTokenScope = (typeof ACCESS_TOKEN_SCOPES)[number];

/**
 * A personal access token: a writer's key for the small public API (`/api/v1`), for scripts, iOS
 * Shortcuts or Zapier, limited to its scopes. Only the SHA-256 of the token is kept; the token itself is
 * shown once, when it is made. Revoking it deletes the row; it goes with the account.
 */
@Entity('personal_access_tokens')
@Index('uq_personal_access_tokens_token_hash', ['tokenHash'], { unique: true })
@Index('idx_personal_access_tokens_user', ['userId'])
export class PersonalAccessToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  /** The writer's own name for it, such as "iPhone Shortcut". */
  @Column({ type: 'varchar', length: 60 })
  name: string;

  /** SHA-256 (hex) of the token; the token itself is never stored. */
  @Column({ name: 'token_hash', type: 'varchar', length: 64, select: false })
  tokenHash: string;

  /** The token's first characters (`thy_` and four more), to tell tokens apart in the list. */
  @Column({ name: 'token_hint', type: 'varchar', length: 12 })
  tokenHint: string;

  @Column({ type: 'text', array: true })
  scopes: AccessTokenScope[];

  /** The time zone of the browser that made it: an entry written without a date gets that zone's day. */
  @Column({ name: 'time_zone', type: 'varchar', length: 64 })
  timeZone: string;

  /** Null for a token that never expires. */
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  /** When the token last opened a public API request, to the minute; null when never used. */
  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
