import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Entry, TIME_OF_DAY_TRANSFORMER } from './entry.entity';

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

  @Column({ name: 'time_of_day', type: 'time', precision: 0, nullable: true, transformer: TIME_OF_DAY_TRANSFORMER })
  timeOfDay: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string | null;

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
