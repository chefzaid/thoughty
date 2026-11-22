import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Diary } from './diary.entity';
import { User } from './user.entity';

/**
 * A diary's own writing reminder: the writing reminder email at this diary's hour on each day without an
 * entry in it, opening the composer on it. It overrides the account reminder for this diary, and its
 * zone follows the account reminder's. `lastSentOn` is the local day it last went out.
 */
@Entity('diary_writing_reminders')
export class DiaryWritingReminder {
  @PrimaryColumn({ name: 'diary_id', type: 'integer' })
  diaryId: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  /** Off only after the email's unsubscribe link; removing the hour in Manage Diaries deletes the row. */
  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  /** 0 to 23, on the wall clock of `timeZone`. */
  @Column({ name: 'delivery_hour', type: 'smallint' })
  deliveryHour: number;

  @Column({ name: 'time_zone', type: 'varchar', length: 64 })
  timeZone: string;

  @Column({ name: 'next_send_at', type: 'timestamptz' })
  nextSendAt: Date;

  /** The writer's local day (YYYY-MM-DD) of the last reminder, so a day never gets two. */
  @Column({ name: 'last_sent_on', type: 'date', nullable: true })
  lastSentOn: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => Diary, (diary) => diary.writingReminder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'diary_id' })
  diary: Diary;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
