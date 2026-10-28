import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BookVersion } from './book-version.entity';
import { Entry } from './entry.entity';
import { User } from './user.entity';

/**
 * A private share link: one entry or one book version, readable without signing in by whoever holds
 * the link until it expires, its views run out, or the writer revokes (deletes) it. Only the SHA-256 of
 * its token is kept; the token itself is shown once, when the link is made.
 */
@Entity('share_links')
@Index('uq_share_links_token_hash', ['tokenHash'], { unique: true })
@Index('idx_share_links_user_created', ['userId', 'createdAt'])
@Index('idx_share_links_entry', ['entryId'], { where: 'entry_id IS NOT NULL' })
@Index('idx_share_links_book_version', ['bookVersionId'], { where: 'book_version_id IS NOT NULL' })
export class ShareLink {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  /** The entry it shares; null for a book version. */
  @Column({ name: 'entry_id', type: 'integer', nullable: true })
  entryId: number | null;

  /** The book version it shares; null for an entry. */
  @Column({ name: 'book_version_id', type: 'integer', nullable: true })
  bookVersionId: number | null;

  /** SHA-256 (hex) of the link's token; the token itself is never stored. */
  @Column({ name: 'token_hash', type: 'varchar', length: 64, select: false })
  tokenHash: string;

  /** The writer's own note on who the link is for; never shown to the reader. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  label: string | null;

  /** Whether the reader sees the entry's mood and feelings. */
  @Column({ name: 'show_mood', type: 'boolean', default: false })
  showMood: boolean;

  /** Whether the reader sees the entry's tags. */
  @Column({ name: 'show_tags', type: 'boolean', default: false })
  showTags: boolean;

  /** How many times the entry may be opened or the book downloaded; null for no limit. */
  @Column({ name: 'max_views', type: 'integer', nullable: true })
  maxViews: number | null;

  @Column({ name: 'view_count', type: 'integer', default: 0 })
  viewCount: number;

  @Column({ name: 'last_viewed_at', type: 'timestamptz', nullable: true })
  lastViewedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Entry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry: Entry | null;

  @ManyToOne(() => BookVersion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_version_id' })
  bookVersion: BookVersion | null;
}
