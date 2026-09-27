import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Entry } from './entry.entity';
import { User } from './user.entity';

export const ENTRY_COMMENT_MAX_LENGTH = 1000;

@Entity('entry_comments')
export class EntryComment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'entry_id', type: 'integer' })
  entryId: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ type: 'varchar', length: ENTRY_COMMENT_MAX_LENGTH })
  content: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => Entry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry: Entry;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
