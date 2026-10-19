import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn } from 'typeorm';
import { Entry } from './entry.entity';
import { User } from './user.entity';

/** Links a guided memoir question to the journal entry that answers it; one answer per question. */
@Entity('memoir_answers')
export class MemoirAnswer {
  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId: number;

  @PrimaryColumn({ name: 'question_id', type: 'varchar', length: 64 })
  questionId: string;

  @Column({ name: 'entry_id', type: 'integer', unique: true })
  entryId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToOne(() => Entry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry: Entry;
}
