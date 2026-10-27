import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Entry } from './entry.entity';
import { User } from './user.entity';

/**
 * An entry sealed as a time capsule until a local date and hour. While it is sealed (`openedAt` is
 * null) the entry's title, text, tags, mood and feelings live here and the entry row holds none of them;
 * opening moves them back and clears this copy, keeping the row as a record of when it opened.
 */
@Entity('time_capsules')
export class TimeCapsule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'entry_id', type: 'integer', unique: true })
  entryId: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  /** The writer's local day it opens on (YYYY-MM-DD). */
  @Column({ name: 'opens_on', type: 'date' })
  opensOn: string;

  /** The local hour it opens at, 0 to 23. */
  @Column({ name: 'open_hour', type: 'smallint' })
  openHour: number;

  /** The IANA time zone the writer sealed it in. */
  @Column({ name: 'time_zone', type: 'varchar', length: 64 })
  timeZone: string;

  /** The instant it opens: `opensOn` at `openHour` on the zone's clock. */
  @Column({ name: 'open_at', type: 'timestamptz' })
  openAt: Date;

  @Column({ name: 'sealed_title', type: 'varchar', length: 200, nullable: true })
  sealedTitle: string | null;

  @Column({ name: 'sealed_content', type: 'text', nullable: true })
  sealedContent: string | null;

  @Column('text', { name: 'sealed_tags', array: true, default: [] })
  sealedTags: string[];

  @Column({ name: 'sealed_mood', type: 'smallint', nullable: true })
  sealedMood: number | null;

  @Column('text', { name: 'sealed_feelings', array: true, default: [] })
  sealedFeelings: string[];

  /** When it opened, on schedule or early; null while it is sealed. */
  @Column({ name: 'opened_at', type: 'timestamptz', nullable: true })
  openedAt: Date | null;

  /** When it was sealed. */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToOne(() => Entry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry: Entry;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
