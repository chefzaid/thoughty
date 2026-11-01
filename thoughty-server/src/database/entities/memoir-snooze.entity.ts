import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { MemoirProgram } from './memoir-program.entity';

/** A memoir question set aside with "Not this week": it comes back from the writer's day `snoozedUntil`. */
@Entity('memoir_snoozes')
export class MemoirSnooze {
  @PrimaryColumn({ name: 'program_id', type: 'integer' })
  programId: number;

  @PrimaryColumn({ name: 'question_id', type: 'varchar', length: 64 })
  questionId: string;

  /** `YYYY-MM-DD` in the program's time zone. */
  @Column({ name: 'snoozed_until', type: 'date' })
  snoozedUntil: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => MemoirProgram, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'program_id' })
  program: MemoirProgram;
}
