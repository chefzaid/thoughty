import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Diary } from './diary.entity';
import { User } from './user.entity';

export type MemoirProgramStatus = 'active' | 'paused';

@Entity('memoir_programs')
export class MemoirProgram {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer', unique: true })
  userId: number;

  @Column({ name: 'diary_id', type: 'integer', nullable: true })
  diaryId: number | null;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: MemoirProgramStatus;

  @Column({ name: 'email_enabled', type: 'boolean', default: true })
  emailEnabled: boolean;

  /** 0 = Sunday through 6 = Saturday, in the program's time zone. */
  @Column({ name: 'delivery_weekday', type: 'smallint' })
  deliveryWeekday: number;

  @Column({ name: 'time_zone', type: 'varchar', length: 64, default: 'UTC' })
  timeZone: string;

  @Column({ name: 'current_question_id', type: 'varchar', length: 64, nullable: true })
  currentQuestionId: string | null;

  @Column({ name: 'current_question_at', type: 'timestamptz', nullable: true })
  currentQuestionAt: Date | null;

  @Column({ name: 'next_delivery_at', type: 'timestamptz' })
  nextDeliveryAt: Date;

  @Column({ name: 'last_emailed_at', type: 'timestamptz', nullable: true })
  lastEmailedAt: Date | null;

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
