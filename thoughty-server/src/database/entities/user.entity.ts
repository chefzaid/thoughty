import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Diary } from './diary.entity';
import { Entry } from './entry.entity';
import { RefreshToken } from './refresh-token.entity';
import { Setting } from './setting.entity';

/** Usernames are unique ignoring case (`lower(username)`), as sign-in matches them. */
export const USERNAME_UNIQUE_INDEX = 'uq_users_username_lower';

@Entity('users')
// A unique expression index TypeORM cannot describe; migration 1788134400000 builds it.
@Index(USERNAME_UNIQUE_INDEX, { synchronize: false })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * New names are cut to 50 characters (`USERNAME_MAX_LENGTH`); the column keeps up to 100, as older
   * accounts may. Unique ignoring case (`USERNAME_UNIQUE_INDEX`).
   */
  @Column({ length: 100 })
  username: string;

  /**
   * Stored in lower case (`chk_users_email_lowercase`), so the unique key ignores case too. An account
   * that had none holds a placeholder on the reserved `.invalid` domain (`isPlaceholderEmail`), which
   * counts as no address: nothing is sent to it, and the writer is asked for a real one.
   */
  @Column({ length: 255, unique: true })
  email: string;

  /** The address a writer gave in place of a placeholder, until they open the link sent to it. */
  @Column({ name: 'pending_email', type: 'varchar', length: 255, nullable: true })
  pendingEmail: string | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  @Column({ name: 'auth_provider', type: 'varchar', length: 50, default: 'local' })
  authProvider: string;

  @Column({ name: 'provider_id', type: 'varchar', length: 255, nullable: true })
  providerId: string | null;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ name: 'email_verification_token', type: 'varchar', length: 255, nullable: true })
  emailVerificationToken: string | null;

  @Column({ name: 'email_verification_token_expires', type: 'timestamp', nullable: true })
  emailVerificationTokenExpires: Date | null;

  @Column({ name: 'reset_token', type: 'varchar', length: 255, nullable: true })
  resetToken: string | null;

  @Column({ name: 'reset_token_expires', type: 'timestamp', nullable: true })
  resetTokenExpires: Date | null;

  @Column({ name: 'two_factor_enabled', type: 'boolean', default: false })
  twoFactorEnabled: boolean;

  @Column({ name: 'two_factor_challenge_token_hash', type: 'varchar', length: 64, nullable: true })
  twoFactorChallengeTokenHash: string | null;

  @Column({ name: 'two_factor_challenge_code_hash', type: 'varchar', length: 64, nullable: true })
  twoFactorChallengeCodeHash: string | null;

  @Column({ name: 'two_factor_challenge_purpose', type: 'varchar', length: 16, nullable: true })
  twoFactorChallengePurpose: string | null;

  @Column({ name: 'two_factor_challenge_expires', type: 'timestamp', nullable: true })
  twoFactorChallengeExpires: Date | null;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date | null;

  /**
   * Followers by approval: new follows wait as requests until the writer approves them, and only approved
   * followers read the writer's public entries (others see a teaser). Off unless the writer turns it on.
   */
  @Column({ name: 'followers_by_approval', type: 'boolean', default: false })
  followersByApproval: boolean;

  @Column({ name: 'deletion_reason', type: 'text', nullable: true })
  deletionReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Diary, (diary) => diary.user)
  diaries: Diary[];

  @OneToMany(() => Entry, (entry) => entry.user)
  entries: Entry[];

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: RefreshToken[];

  @OneToMany(() => Setting, (setting) => setting.user)
  settings: Setting[];
}
