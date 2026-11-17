import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * An unlock the writer's PIN gave: while it lasts, requests that carry its token (the
 * `X-Content-Unlock` header) read locked diaries and entries. Only the token's SHA-256 is kept. It ends
 * after `CONTENT_UNLOCK_IDLE_MS` without a request, or when the writer locks again.
 */
@Entity('content_unlocks')
@Index('uq_content_unlocks_token_hash', ['tokenHash'], { unique: true })
@Index('idx_content_unlocks_user', ['userId'])
export class ContentUnlock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ name: 'token_hash', type: 'varchar', length: 64, select: false })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
