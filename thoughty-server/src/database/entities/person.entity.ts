import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Entry } from './entry.entity';
import { User } from './user.entity';

/** What a date on a person marks. */
export const PERSON_DATE_KINDS = ['birthday', 'anniversary'] as const;
export type PersonDateKind = (typeof PERSON_DATE_KINDS)[number];

/**
 * Someone the writer mentions in their entries (`@Marie`). People are the writer's private records:
 * they are never platform users and are never linked to accounts.
 */
@Entity('people')
export class Person {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  /** The name shown for the person: the handle as first written, until the writer changes it. */
  @Column({ type: 'varchar', length: 80 })
  name: string;

  /**
   * At most how many days the writer wants to go without being in touch with the person; null for no reminder.
   * Highlights shows them once this many days have passed since `lastContactOn` or their newest mention.
   */
  @Column({ name: 'reach_out_days', type: 'smallint', nullable: true })
  reachOutDays: number | null;

  /** The last day (`YYYY-MM-DD`) the writer was in touch with the person, as they recorded it; null when never recorded. */
  @Column({ name: 'last_contact_on', type: 'date', nullable: true })
  lastContactOn: string | null;

  /** The writer's own notes on the person (how they met, what they like, a gift idea); null when there are none. */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** The writer's own groups the person belongs to (Friends, Family, Colleagues…), as named; empty when none. */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  groups: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

/**
 * A handle that mentions a person, as its case-insensitive key (`marie` for `@Marie`). A person has one
 * at first and gains the handles of the people merged into them; each handle names one person per writer.
 */
@Entity('person_handles')
export class PersonHandle {
  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId: number;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  handle: string;

  @Column({ name: 'person_id', type: 'integer' })
  personId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Person, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'person_id' })
  person: Person;
}

/**
 * An important date on a person: a birthday or an anniversary that comes back each year on `month`/`day`, with
 * `year` when the writer knows it and `label` saying what it marks (a wedding, the day they met). A person has
 * any number of anniversaries and at most one birthday; the database refuses a day that never exists.
 */
@Entity('person_dates')
export class PersonDate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'person_id', type: 'integer' })
  personId: number;

  @Column({ type: 'varchar', length: 16 })
  kind: PersonDateKind;

  @Column({ type: 'varchar', length: 40, nullable: true })
  label: string | null;

  /** 1 to 12. */
  @Column({ type: 'smallint' })
  month: number;

  @Column({ type: 'smallint' })
  day: number;

  @Column({ type: 'smallint', nullable: true })
  year: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Person, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'person_id' })
  person: Person;
}

/** An entry that mentions a person, rebuilt from the entry's text each time it is saved. */
@Entity('entry_people')
export class EntryPerson {
  @PrimaryColumn({ name: 'entry_id', type: 'integer' })
  entryId: number;

  @PrimaryColumn({ name: 'person_id', type: 'integer' })
  personId: number;

  @ManyToOne(() => Entry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry: Entry;

  @ManyToOne(() => Person, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'person_id' })
  person: Person;
}
