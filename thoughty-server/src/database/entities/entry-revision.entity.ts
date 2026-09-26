import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Entry } from './entry.entity';

@Entity('entry_revisions')
export class EntryRevision {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'entry_id' })
  entryId: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ type: 'varchar', length: 10 })
  date: string;

  @Column({ type: 'varchar', length: 20, default: 'plaintext' })
  format: string;

  @Column({ type: 'varchar', length: 20, default: 'private' })
  visibility: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Entry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry: Entry;
}
