import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Diary } from './diary.entity';
import { Attachment } from './attachment.entity';

@Entity('entries')
@Index('idx_entries_user_pinned_date_index', ['userId', 'isPinned', 'date', 'index'])
@Index('idx_entries_user_diary_date_index', ['userId', 'diaryId', 'date', 'index'])
@Index('idx_entries_user_visibility_date', ['userId', 'visibility', 'date'])
@Index('idx_entries_user_archive_date', ['userId', 'isArchived', 'date'])
@Index('idx_entries_user_favorite_date', ['userId', 'isFavorite', 'date'])
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

  @Column('text', { array: true, default: [] })
  tags: string[];

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 20, default: 'plain' })
  format: 'plain' | 'markdown';

  @Column({ type: 'varchar', length: 20, default: 'private' })
  visibility: 'public' | 'private';

  @Column({ name: 'is_favorite', type: 'boolean', default: false })
  isFavorite: boolean;

  @Column({ name: 'is_archived', type: 'boolean', default: false })
  isArchived: boolean;

  @Column({ name: 'is_pinned', type: 'boolean', default: false })
  isPinned: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.entries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Diary, (diary) => diary.entries, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'diary_id' })
  diary: Diary | null;

  @OneToMany(() => Attachment, (attachment) => attachment.entry, { cascade: true })
  attachments: Attachment[];
}
