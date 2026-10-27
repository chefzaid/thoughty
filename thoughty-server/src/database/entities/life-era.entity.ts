import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

/** A named date range of the writer's life ("University"); eras may overlap. */
@Entity('life_eras')
export class LifeEra {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  /** `YYYY-MM-DD`, the first day of the era. */
  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  /** `YYYY-MM-DD`, the last day of the era; null while it is still going on. */
  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  /** `#RRGGBB` in capitals, or null. */
  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  emoji: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
