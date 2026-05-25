import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { CloudProviderType } from '@/modules/cloud-sync/dto';

export const CLOUD_SYNC_JOB_STATUSES = ['queued', 'running', 'completed', 'failed'] as const;
export type CloudSyncJobStatus = (typeof CLOUD_SYNC_JOB_STATUSES)[number];

export const CLOUD_SYNC_JOB_TRIGGER_TYPES = ['scheduled'] as const;
export type CloudSyncJobTriggerType = (typeof CLOUD_SYNC_JOB_TRIGGER_TYPES)[number];

@Entity('cloud_sync_jobs')
@Index('idx_cloud_sync_jobs_user_id', ['userId'])
@Index('idx_cloud_sync_jobs_status_run_at', ['status', 'runAt'])
export class CloudSyncJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number;

  @Column({ type: 'varchar', length: 32 })
  provider: CloudProviderType;

  @Column({ name: 'trigger_type', type: 'varchar', length: 32, default: 'scheduled' })
  triggerType: CloudSyncJobTriggerType;

  @Column({ type: 'varchar', length: 32, default: 'queued' })
  status: CloudSyncJobStatus;

  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount: number;

  @Column({ name: 'max_attempts', type: 'integer', default: 3 })
  maxAttempts: number;

  @Column({ name: 'run_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  runAt: Date;

  @Column({ name: 'locked_at', type: 'timestamp', nullable: true })
  lockedAt: Date | null;

  @Column({ name: 'locked_by', type: 'varchar', length: 120, nullable: true })
  lockedBy: string | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'result_message', type: 'text', nullable: true })
  resultMessage: string | null;

  @Column({ name: 'finished_at', type: 'timestamp', nullable: true })
  finishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}