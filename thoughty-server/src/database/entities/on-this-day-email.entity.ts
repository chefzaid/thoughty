import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Diary } from './diary.entity';
import { User } from './user.entity';

/**
 * A writer's "On this day" email: whether it is on, the local hour and zone it arrives in, the diary it
 * reads (null for all of them), and when the worker should next look at it.
 */
@Entity('on_this_day_emails')
export class OnThisDayEmail {
  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  /** 0 to 23, on the wall clock of `timeZone`. */
  @Column({ name: 'delivery_hour', type: 'smallint' })
  deliveryHour: number;

  @Column({ name: 'time_zone', type: 'varchar', length: 64 })
  timeZone: string;

  @Column({ name: 'diary_id', type: 'integer', nullable: true })
  diaryId: number | null;

  @Column({ name: 'next_send_at', type: 'timestamptz' })
  nextSendAt: Date;

  /** The writer's local day (YYYY-MM-DD) of the last email, so a day never gets two. */
  @Column({ name: 'last_sent_on', type: 'date', nullable: true })
  lastSentOn: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Diary, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'diary_id' })
  diary: Diary | null;
}
