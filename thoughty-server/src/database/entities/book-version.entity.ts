import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Diary } from './diary.entity';
import { User } from './user.entity';

export interface BookVersionManifest {
  chapters: Array<{ title: string; entryIds: number[] }>;
}

/**
 * Where a book's entries came from, so a new version is generated from the same place: the
 * journal (one diary or all of them), a saved search (its filters as they are when the version
 * is made), or entries the writer picked by hand.
 */
export type BookVersionSource =
  | { kind: 'journal'; diaryId?: number | null }
  | { kind: 'savedSearch'; savedSearchId: number; savedSearchName: string }
  | { kind: 'entries'; entryIds: number[] };

@Entity('book_versions')
export class BookVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ name: 'diary_id', type: 'integer', nullable: true })
  diaryId: number | null;

  @Column({ name: 'scope_key', type: 'varchar', length: 32 })
  scopeKey: string;

  @Column({ name: 'version_number', type: 'integer' })
  versionNumber: number;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  author: string | null;

  @Column({ type: 'varchar', length: 8 })
  format: string;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({ name: 'content_type', type: 'varchar', length: 100 })
  contentType: string;

  @Column({ type: 'bytea', select: false })
  content: Buffer;

  @Column({ type: 'jsonb' })
  manifest: BookVersionManifest;

  @Column({ type: 'jsonb', default: () => `'{"kind":"journal"}'::jsonb` })
  source: BookVersionSource;

  @Column({ name: 'chapter_count', type: 'integer' })
  chapterCount: number;

  @Column({ name: 'entry_count', type: 'integer' })
  entryCount: number;

  @Column({ name: 'added_entry_count', type: 'integer' })
  addedEntryCount: number;

  @Column({ name: 'added_chapter_titles', type: 'jsonb', default: () => "'[]'::jsonb" })
  addedChapterTitles: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Diary, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'diary_id' })
  diary: Diary | null;
}
