import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './user.entity';

/** A writer blocked by another: each is out of the other's social features, and neither is told. */
@Entity('user_blocks')
export class UserBlock {
  @PrimaryColumn({ name: 'blocker_id', type: 'integer' })
  blockerId: number;

  @PrimaryColumn({ name: 'blocked_id', type: 'integer' })
  blockedId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blocker_id' })
  blocker: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blocked_id' })
  blocked: User;
}
