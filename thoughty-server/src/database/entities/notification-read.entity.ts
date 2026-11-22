import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { User } from './user.entity';

/** When a writer last opened their notifications; what came after is new to them. */
@Entity('notification_reads')
export class NotificationRead {
  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ name: 'read_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  readAt: Date;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
