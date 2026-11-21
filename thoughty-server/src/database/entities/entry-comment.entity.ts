import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Entry } from './entry.entity';
import { User } from './user.entity';

export const ENTRY_COMMENT_MAX_LENGTH = 1000;

@Entity('entry_comments')
@Index('uq_entry_comments_pinned', ['entryId'], { unique: true, where: 'pinned_at IS NOT NULL' })
export class EntryComment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'entry_id', type: 'integer' })
  entryId: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ type: 'varchar', length: ENTRY_COMMENT_MAX_LENGTH })
  content: string;

  /** When the entry's writer hid the comment: then only they and the comment's writer see it. */
  @Column({ name: 'hidden_at', type: 'timestamptz', nullable: true })
  hiddenAt: Date | null;

  /** When the entry's writer pinned the comment on top; one per entry at most, never a hidden one. */
  @Column({ name: 'pinned_at', type: 'timestamptz', nullable: true })
  pinnedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => Entry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry: Entry;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
