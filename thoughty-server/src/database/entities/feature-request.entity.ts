import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { FeatureRequestVote } from './feature-request-vote.entity';

export const FEATURE_REQUEST_STATUSES = ['open', 'reviewing', 'planned'] as const;
export type FeatureRequestStatus = (typeof FEATURE_REQUEST_STATUSES)[number];

@Entity('feature_requests')
export class FeatureRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'text' })
  details: string;

  @Column({ type: 'varchar', length: 24, default: 'open' })
  status: FeatureRequestStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => FeatureRequestVote, (vote) => vote.featureRequest)
  votes: FeatureRequestVote[];
}
