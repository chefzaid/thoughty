import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { FeatureRequest } from './feature-request.entity';

@Entity('feature_request_votes')
@Unique('uq_feature_request_votes_request_user', ['featureRequestId', 'userId'])
export class FeatureRequestVote {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'feature_request_id', type: 'integer' })
  featureRequestId: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => FeatureRequest, (request) => request.votes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'feature_request_id' })
  featureRequest: FeatureRequest;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
