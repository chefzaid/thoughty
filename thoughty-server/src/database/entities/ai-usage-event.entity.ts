import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

export type AiCredentialSource = 'personal' | 'server';

@Entity('ai_usage_events')
@Index(['userId', 'createdAt'])
export class AiUsageEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId!: number;

  @Column({ name: 'credential_source', type: 'varchar', length: 16 })
  credentialSource!: AiCredentialSource;

  @Column({ type: 'varchar', length: 200 })
  model!: string;

  @Column({ name: 'prompt_tokens', type: 'integer', default: 0 })
  promptTokens!: number;

  @Column({ name: 'completion_tokens', type: 'integer', default: 0 })
  completionTokens!: number;

  @Column({ name: 'reasoning_tokens', type: 'integer', default: 0 })
  reasoningTokens!: number;

  @Column({ name: 'total_tokens', type: 'integer', default: 0 })
  totalTokens!: number;

  @Column({ type: 'numeric', precision: 14, scale: 8, default: 0 })
  cost!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
