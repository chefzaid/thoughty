import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Diary } from './diary.entity';
import { User } from './user.entity';

/** The journal filters a saved search restores, as the filter bar holds them. */
export interface SavedSearchFilters {
  search: string;
  searchMode: 'keyword' | 'semantic';
  sort: 'relevance' | 'date';
  tags: string[];
  /** `YYYY-MM-DD`, or null for any date. */
  date: string | null;
  visibility: 'all' | 'public' | 'private';
  archiveStatus: 'active' | 'archived' | 'all';
  favorites: boolean;
  /** Mood levels (`4,5`), `any`, `none`, or empty for any mood. */
  mood: string;
  /** The life era the entries are dated in; null, or missing in searches saved before eras, for any. */
  eraId?: number | null;
}

/** A named combination of journal filters and a diary scope, kept per writer. */
@Entity('saved_searches')
export class SavedSearch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  /** Null for all diaries, and when the diary is deleted. */
  @Column({ name: 'diary_id', type: 'integer', nullable: true })
  diaryId: number | null;

  @Column({ type: 'jsonb' })
  filters: SavedSearchFilters;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Diary, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'diary_id' })
  diary: Diary | null;
}
