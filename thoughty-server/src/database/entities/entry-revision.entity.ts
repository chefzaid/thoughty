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

  @Column()
  entryId: number;

  @Column()
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

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Entry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entryId' })
  entry: Entry;
}
