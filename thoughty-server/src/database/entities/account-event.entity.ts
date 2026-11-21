import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/** What an account activity row records: a sign-in or an action that reaches or changes the account's security. */
export const ACCOUNT_EVENT_KINDS = [
  'sign_in',
  'sign_in_refused',
  'sign_out',
  'sessions_revoked',
  'password_changed',
  'password_reset',
  'two_factor_enabled',
  'two_factor_disabled',
  'pin_set',
  'pin_changed',
  'pin_reset',
  'pin_removed',
  'data_downloaded',
  'journal_exported',
  'share_link_created',
  'share_link_revoked',
  'access_token_created',
  'access_token_revoked',
] as const;

export type AccountEventKind = (typeof ACCOUNT_EVENT_KINDS)[number];

/**
 * One line of a writer's account activity (Profile › Privacy): what happened and the browser and system
 * it came from, read from the request's user agent. No IP address and no version number is kept; rows
 * older than a year are removed by the background worker, and all of them go with the account.
 */
@Entity('account_events')
@Index('idx_account_events_user_created', ['userId', 'createdAt'])
@Index('idx_account_events_created', ['createdAt'])
export class AccountEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId!: number;

  @Column({ type: 'varchar', length: 32 })
  kind!: AccountEventKind;

  @Column({ type: 'varchar', length: 40, nullable: true })
  browser!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  system!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
