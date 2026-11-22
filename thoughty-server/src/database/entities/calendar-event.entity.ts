import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * An event from a calendar file (ICS) the writer imported, shown in the composer on its day. An all-day
 * event keeps its days (`startDate` to `endDate`, both included); a timed one its instants.
 */
@Entity('calendar_events')
@Unique('uq_calendar_events_user_uid', ['userId', 'uid'])
export class CalendarEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  /** The event's `UID` in its calendar, so importing the file again updates it instead of adding it twice. */
  @Column({ type: 'varchar', length: 255 })
  uid: string;

  /** Empty when the event has no title. */
  @Column({ type: 'varchar', length: 200 })
  summary: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location: string | null;

  @Column({ name: 'all_day', type: 'boolean' })
  allDay: boolean;

  /** A timed event's start and end; null for an all-day event. */
  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  /** `YYYY-MM-DD`, an all-day event's first and last days; null for a timed event. */
  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
