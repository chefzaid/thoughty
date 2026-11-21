import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Diary } from './diary.entity';
import { User } from './user.entity';

/**
 * The AI reading of seven days of entries, ending on the writer's day it was asked on: the themes that came
 * back, a short summary and one question for the week ahead. Kept until the writer asks again; one per diary scope.
 */
@Entity('weekly_reflections')
export class WeeklyReflection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  /** Null for a reflection on all diaries. */
  @Column({ name: 'diary_id', type: 'integer', nullable: true })
  diaryId: number | null;

  /** `YYYY-MM-DD`, six days before `weekEnd`. */
  @Column({ name: 'week_start', type: 'date' })
  weekStart: string;

  /** `YYYY-MM-DD`, the writer's day the reflection was asked on. */
  @Column({ name: 'week_end', type: 'date' })
  weekEnd: string;

  @Column({ type: 'jsonb' })
  themes: string[];

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'text' })
  question: string;

  @Column({ name: 'analyzed_entries', type: 'integer' })
  analyzedEntries: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Diary, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'diary_id' })
  diary: Diary | null;
}
