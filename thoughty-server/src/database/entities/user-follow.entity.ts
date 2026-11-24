import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './user.entity';

/** A follow is `approved`, or a `pending` request to a writer who approves their followers. */
export const FOLLOW_STATUSES = ['approved', 'pending'] as const;
export type FollowStatus = (typeof FOLLOW_STATUSES)[number];

@Entity('user_follows')
export class UserFollow {
  @PrimaryColumn({ name: 'follower_id', type: 'integer' })
  followerId: number;

  @PrimaryColumn({ name: 'followed_id', type: 'integer' })
  followedId: number;

  /** Only approved follows count: in the feed, the follower counts, comments for followers and notifications. */
  @Column({ type: 'varchar', length: 8, default: 'approved' })
  status: FollowStatus;

  /** When the follow, or the request, was made. */
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'follower_id' })
  follower: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followed_id' })
  followed: User;
}
