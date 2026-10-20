import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Diary } from './diary.entity';
import { User } from './user.entity';

export interface YearReviewMoodMonth {
  /** `YYYY-MM` */
  month: string;
  mood: string;
  /** From -2 (very low) to 2 (very bright). */
  valence: number;
}

/** The AI-read mood of each month of a year, kept until the writer asks again; one per year and diary scope. */
@Entity('year_review_moods')
export class YearReviewMood {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  /** Null for a review of all diaries. */
  @Column({ name: 'diary_id', type: 'integer', nullable: true })
  diaryId: number | null;

  @Column({ type: 'smallint' })
  year: number;

  @Column({ type: 'jsonb' })
  months: YearReviewMoodMonth[];

  @Column({ type: 'text' })
  summary: string;

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
