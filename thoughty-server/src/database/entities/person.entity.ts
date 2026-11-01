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
   * A birthday or an anniversary that comes back each year on `dateMonth`/`dateDay`, with `dateYear` when the
   * writer knows it. Kind, month and day are all set or all null; the database refuses a day that never exists.
   */
  @Column({ name: 'date_kind', type: 'varchar', length: 16, nullable: true })
  dateKind: PersonDateKind | null;

  /** 1 to 12. */
  @Column({ name: 'date_month', type: 'smallint', nullable: true })
  dateMonth: number | null;

  @Column({ name: 'date_day', type: 'smallint', nullable: true })
  dateDay: number | null;

  @Column({ name: 'date_year', type: 'smallint', nullable: true })
  dateYear: number | null;

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
