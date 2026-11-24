import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A sign-up waiting for its address to be proven (see `SignUpService`). With a token, the emailed
 * link creates the account once the same password is entered again; without one, the address
 * already has an account and the row only spaces out the notices sent to it. Expired rows are purged.
 */
@Entity('sign_up_requests')
export class SignUpRequest {
  @PrimaryGeneratedColumn()
  id: number;

  /** Lowercase. */
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  /** SHA-256 of the link's single-use token; the token itself is only in the email. */
  @Column({ name: 'token_hash', type: 'varchar', length: 64, nullable: true, unique: true })
  tokenHash: string | null;

  /** bcrypt hash of the password chosen on the sign-up form. */
  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  /** The username asked for, checked only when the account is created. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  username: string | null;

  /** The language the visitor read the pages in (`en`, `fr`): the account starts in it. */
  @Column({ type: 'varchar', length: 2, nullable: true })
  language: string | null;

  /** The theme the visitor saw (`light`, `dark`): the account starts in it. */
  @Column({ type: 'varchar', length: 5, nullable: true })
  theme: string | null;

  @Column({ name: 'sent_count', type: 'smallint', default: 1 })
  sentCount: number;

  @Column({ name: 'last_sent_at', type: 'timestamptz' })
  lastSentAt: Date;

  @Index('idx_sign_up_requests_expires_at')
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
