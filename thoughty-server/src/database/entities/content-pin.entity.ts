import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * A writer's PIN for locked diaries and entries: four digits, kept as a bcrypt hash like a password. A
 * four-digit PIN is a weak secret, so the wrong tries are counted here (surviving restarts) and earn a
 * growing lockout (`blockedUntil`).
 */
@Entity('content_pins')
export class ContentPin {
  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ name: 'pin_hash', type: 'varchar', length: 100 })
  pinHash: string;

  /** Wrong tries since the last right one; from the fifth, each blocks further tries for a while. */
  @Column({ name: 'failed_attempts', type: 'integer', default: 0 })
  failedAttempts: number;

  /** Until when no PIN is accepted; null when tries are open. */
  @Column({ name: 'blocked_until', type: 'timestamptz', nullable: true })
  blockedUntil: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
