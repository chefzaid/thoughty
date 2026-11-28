import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  type ValueTransformer,
} from 'typeorm';
import { User } from './user.entity';
import { Diary } from './diary.entity';
import { Attachment } from './attachment.entity';

/** Who may comment on a public entry: anyone, the writer's followers, or no one (`closed`). */
export const COMMENT_POLICIES = ['everyone', 'followers', 'closed'] as const;
export type CommentPolicy = (typeof COMMENT_POLICIES)[number];

/**
 * PostgreSQL returns a `TIME(0)` as `08:30:00`; entries keep and expose it as `08:30`.
 * Exported for the entry revisions, which store the time the same way.
 */
export const TIME_OF_DAY_TRANSFORMER: ValueTransformer = {
  to: (value?: string | null) => value,
  from: (value?: string | null) => (typeof value === 'string' ? value.slice(0, 5) : null),
};

@Entity('entries')
@Index('idx_entries_user_pinned_date_index', ['userId', 'isPinned', 'date', 'index'])
@Index('idx_entries_user_diary_date_index', ['userId', 'diaryId', 'date', 'index'])
@Index('idx_entries_user_visibility_date', ['userId', 'visibility', 'date'])
@Index('idx_entries_user_archive_date', ['userId', 'isArchived', 'date'])
@Index('idx_entries_user_favorite_date', ['userId', 'isFavorite', 'date'])
@Index('idx_entries_public_feed', ['visibility', 'moderationStatus', 'isArchived', 'createdAt'])
@Index('idx_entries_user_import_ref', ['userId', 'importRef'], {
  unique: true,
  where: 'import_ref IS NOT NULL AND deleted_at IS NULL',
})
@Index('idx_entries_user_deleted_at', ['userId', 'deletedAt'], { where: 'deleted_at IS NOT NULL' })
@Index('idx_entries_user_mood_date', ['userId', 'mood', 'date'], { where: 'mood IS NOT NULL' })
@Index('idx_entries_user_reread_on', ['userId', 'rereadOn'], { where: 'reread_on IS NOT NULL' })
export class Entry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ name: 'diary_id', type: 'integer', nullable: true })
  diaryId: number | null;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'integer', default: 1 })
  index: number;

  /**
   * Optional time of day (`HH:MM`). Same-day entries without one come first in their manual
   * order, then those with one, earliest first; it never changes `index`, which cross-references
   * such as `[[2024-01-15#2]]` point at.
   */
  @Column({ name: 'time_of_day', type: 'time', precision: 0, nullable: true, transformer: TIME_OF_DAY_TRANSFORMER })
  timeOfDay: string | null;

  /** Optional one-line title shown above the text, searched with the tags' weight. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string | null;

  @Column('text', { array: true, default: [] })
  tags: string[];

  /**
   * Optional mood check-in from 1 (very low) to 5 (very good), recorded by the writer. It stays
   * private: the public feed and share texts never carry it.
   */
  @Column({ type: 'smallint', nullable: true })
  mood: number | null;

  /** Optional feeling words with the mood: curated ones by their English name, or the writer's own. */
  @Column('text', { array: true, default: [] })
  feelings: string[];

  /**
   * Optional place the entry was written, as the writer named it; with or without coordinates (`latitude` and
   * `longitude`, both or neither), which the browser or an imported app gave. It stays private: the public feed,
   * share links, books and exports never carry it, unless the writer asks a JSON export or a book for it.
   */
  @Column({ name: 'location_name', type: 'varchar', length: 200, nullable: true })
  locationName: string | null;

  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 20, default: 'plain' })
  format: 'plain' | 'markdown';

  @Column({ type: 'varchar', length: 20, default: 'private' })
  visibility: 'public' | 'private';

  @Column({ name: 'moderation_status', type: 'varchar', length: 20, default: 'visible' })
  moderationStatus: 'visible' | 'hidden' | 'under_review' | 'removed';

  /**
   * Who may comment once the entry is public; null follows the writer's `defaultCommentPolicy` setting.
   * Closing keeps the comments already there readable.
   */
  @Column({ name: 'comment_policy', type: 'varchar', length: 20, nullable: true })
  commentPolicy: CommentPolicy | null;

  @Column({ name: 'is_favorite', type: 'boolean', default: false })
  isFavorite: boolean;

  @Column({ name: 'is_archived', type: 'boolean', default: false })
  isArchived: boolean;

  @Column({ name: 'is_pinned', type: 'boolean', default: false })
  isPinned: boolean;

  /** Source app and entry ID (`dayone:<uuid>`, `daily-notes:<path>`) for entries brought in by an app import. */
  @Column({ name: 'import_ref', type: 'varchar', length: 120, nullable: true })
  importRef: string | null;

  /**
   * When an import (a file or an app) brought the entry in; null for an entry written here. Its `createdAt`
   * is then the import's moment, so **When you write** leaves it out unless it has a time of day.
   */
  @Column({ name: 'imported_at', type: 'timestamptz', nullable: true })
  importedAt: Date | null;

  /**
   * While the entry is a sealed time capsule, when it opens; null otherwise. A sealed entry keeps no
   * title, text, tags, mood or feelings here (they wait in `time_capsules`) and stays private.
   */
  @Column({ name: 'sealed_until', type: 'timestamptz', nullable: true })
  sealedUntil: Date | null;

  /**
   * The writer's own day (YYYY-MM-DD) on which they asked to reread the entry; null without a reminder.
   * From that day Highlights shows it until they mark it done. A sealed time capsule never has one.
   */
  @Column({ name: 'reread_on', type: 'date', nullable: true })
  rereadOn: string | null;

  /** Whether the writer locked this entry behind their PIN (see `diaryLocked` for its diary's lock). */
  @Column({ name: 'is_locked', type: 'boolean', default: false })
  isLocked: boolean;

  /**
   * A copy of the diary's `isLocked`, kept in step by database triggers whenever the entry is written,
   * moves to another diary, or its diary is locked or unlocked; the application never writes it. The
   * entry is locked when either flag is set (`LOCKED_ENTRY_SQL`).
   */
  @Column({ name: 'diary_locked', type: 'boolean', default: false, insert: false, update: false })
  diaryLocked: boolean;

  /**
   * Whether the entry's diary has AI off, or uses only the writer's own model (`Diary.aiMode`), kept in step by
   * database triggers as `diaryLocked` is; the application never writes it. No server AI feature reads an entry
   * while it is set.
   */
  @Column({ name: 'diary_ai_off', type: 'boolean', default: false, insert: false, update: false })
  diaryAiOff: boolean;

  /**
   * Whether the entry's diary asks before each AI request (`Diary.aiMode` `ask`), kept in step by the same
   * triggers. An AI action on the entry alone needs the writer's consent; no journal-wide AI feature reads it.
   */
  @Column({ name: 'diary_ai_ask', type: 'boolean', default: false, insert: false, update: false })
  diaryAiAsk: boolean;

  /**
   * Whether the entry's diary uses only the writer's own model (`Diary.aiMode` `local`), kept in step by the same
   * triggers. `diaryAiOff` is set for such an entry too, so the server's AI never reads it; this only names why.
   */
  @Column({ name: 'diary_ai_local', type: 'boolean', default: false, insert: false, update: false })
  diaryAiLocal: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * Title, content, and tags as English and French search terms: a stored column PostgreSQL
   * generates with `entry_search_vector(title, content, tags)`. It is never written by the application and never
   * loaded with the entry; it is not declared as generated so that saves do not read it back.
   */
  @Column({
    name: 'search_vector',
    type: 'tsvector',
    select: false,
    insert: false,
    update: false,
  })
  searchVector?: string;

  /**
   * When the entry went to the recycle bin. TypeORM leaves trashed entries out of every
   * find and select query unless the query asks for them with `withDeleted`.
   */
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @ManyToOne(() => User, (user) => user.entries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Diary, (diary) => diary.entries, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'diary_id' })
  diary: Diary | null;

  @OneToMany(() => Attachment, (attachment) => attachment.entry, { cascade: true })
  attachments: Attachment[];
}
