import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Entry } from './entry.entity';

/** A diary's writing goal: a number of entries each Monday-to-Sunday week, or of words each day. */
export type DiaryGoalType = 'entries_per_week' | 'words_per_day';

/** Diary names are unique per writer, ignoring case and surrounding spaces. */
export const DIARY_NAME_UNIQUE_INDEX = 'uq_diaries_user_name';

@Entity('diaries')
// A unique expression index (`user_id, lower(btrim(name))`) TypeORM cannot describe; the migration builds it.
@Index(DIARY_NAME_UNIQUE_INDEX, { synchronize: false })
export class Diary {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 10, default: '📓' })
  icon: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null;

  @Column({ type: 'varchar', length: 20, default: 'private' })
  visibility: 'public' | 'private';

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'integer', default: 0 })
  position: number;

  /** Optional writing goal; set together with `goalTarget`, or both are null. */
  @Column({ name: 'goal_type', type: 'varchar', length: 20, nullable: true })
  goalType: DiaryGoalType | null;

  /** Entries a week or words a day, within the bounds of `DIARY_GOAL_LIMITS`. */
  @Column({ name: 'goal_target', type: 'integer', nullable: true })
  goalTarget: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.diaries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Entry, (entry) => entry.diary)
  entries: Entry[];
}
