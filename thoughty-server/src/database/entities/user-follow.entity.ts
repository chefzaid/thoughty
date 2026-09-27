import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('user_follows')
export class UserFollow {
  @PrimaryColumn({ name: 'follower_id', type: 'integer' })
  followerId: number;

  @PrimaryColumn({ name: 'followed_id', type: 'integer' })
  followedId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'follower_id' })
  follower: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followed_id' })
  followed: User;
}
