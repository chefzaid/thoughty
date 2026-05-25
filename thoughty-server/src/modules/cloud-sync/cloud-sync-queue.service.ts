import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThanOrEqual, Repository } from 'typeorm';
import { CloudSyncJob, type CloudSyncJobStatus, Setting } from '@/database/entities';
import type { CloudProviderType } from './dto';
import { CloudSyncService } from './cloud-sync.service';

const CLOUD_SYNC_PROVIDERS: CloudProviderType[] = ['google_drive', 'onedrive', 'dropbox'];
const ACTIVE_JOB_STATUSES: CloudSyncJobStatus[] = ['queued', 'running'];
const DEFAULT_MAX_ATTEMPTS = 3;
const JOB_LOCK_TIMEOUT_MS = 15 * 60 * 1000;

@Injectable()
export class CloudSyncQueueService {
  private readonly logger = new Logger(CloudSyncQueueService.name);

  constructor(
    @InjectRepository(CloudSyncJob)
    private readonly jobRepository: Repository<CloudSyncJob>,
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    private readonly dataSource: DataSource,
    private readonly cloudSyncService: CloudSyncService,
  ) {}

  async enqueueDueSyncJobs(): Promise<number> {
    const enabledScheduleSettings = await this.settingRepository.find({
      where: {
        key: In(CLOUD_SYNC_PROVIDERS.map((provider) => this.settingKey(provider, 'sync_enabled'))),
        value: 'true',
      },
    });

    let queuedCount = 0;

    for (const scheduleSetting of enabledScheduleSettings) {
      const provider = this.extractProviderFromScheduleKey(scheduleSetting.key);
      if (!provider) {
        continue;
      }

      const isDue = await this.cloudSyncService.checkSyncDue(scheduleSetting.userId, provider);
      if (!isDue) {
        continue;
      }

      const inserted = await this.enqueueScheduledSyncJob(scheduleSetting.userId, provider);
      if (inserted) {
        queuedCount += 1;
      }
    }

    return queuedCount;
  }

  async enqueueScheduledSyncJob(userId: number, provider: CloudProviderType): Promise<boolean> {
    const insertedRows = await this.dataSource.query(
      `
        INSERT INTO cloud_sync_jobs (
          user_id,
          provider,
          trigger_type,
          status,
          attempt_count,
          max_attempts,
          run_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, 'scheduled', 'queued', 0, $3, NOW(), NOW(), NOW())
        ON CONFLICT DO NOTHING
        RETURNING id
      `,
      [userId, provider, DEFAULT_MAX_ATTEMPTS],
    ) as Array<{ id: number }>;

    return insertedRows.length > 0;
  }

  async recoverStaleJobs(now = new Date()): Promise<number> {
    const staleThreshold = new Date(now.getTime() - JOB_LOCK_TIMEOUT_MS);
    const staleJobs = await this.jobRepository.find({
      where: {
        status: 'running',
        lockedAt: LessThanOrEqual(staleThreshold),
      },
    });

    for (const job of staleJobs) {
      const canRetry = job.attemptCount < job.maxAttempts;
      await this.jobRepository.update(job.id, {
        status: canRetry ? 'queued' : 'failed',
        runAt: canRetry ? now : job.runAt,
        lockedAt: null,
        lockedBy: null,
        finishedAt: canRetry ? null : now,
        lastError: this.appendRecoveryNote(job.lastError),
      });
    }

    return staleJobs.length;
  }

  async processAvailableJobs(workerId: string, maxJobs = 5): Promise<number> {
    let processedCount = 0;

    while (processedCount < maxJobs) {
      const job = await this.claimNextJob(workerId);
      if (!job) {
        break;
      }

      processedCount += 1;
      await this.runJob(job);
    }

    return processedCount;
  }

  private async runJob(job: CloudSyncJob): Promise<void> {
    try {
      const result = await this.cloudSyncService.executeDiffSync(job.userId, job.provider);
      await this.jobRepository.update(job.id, {
        status: 'completed',
        lockedAt: null,
        lockedBy: null,
        finishedAt: new Date(),
        lastError: null,
        resultMessage: result.message,
      });
    } catch (error) {
      await this.failJob(job, error);
    }
  }

  private async failJob(job: CloudSyncJob, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown cloud sync failure';
    const canRetry = job.attemptCount < job.maxAttempts;
    const retryAt = new Date(Date.now() + this.getRetryDelayMs(job.attemptCount));

    await this.jobRepository.update(job.id, {
      status: canRetry ? 'queued' : 'failed',
      runAt: canRetry ? retryAt : job.runAt,
      lockedAt: null,
      lockedBy: null,
      finishedAt: canRetry ? null : new Date(),
      lastError: errorMessage,
      resultMessage: null,
    });

    this.logger.error(
      `Cloud sync job ${job.id} failed for user ${job.userId} and provider ${job.provider}: ${errorMessage}`,
    );
  }

  private async claimNextJob(workerId: string): Promise<CloudSyncJob | null> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const selectedRows = await queryRunner.query(
        `
          SELECT id
          FROM cloud_sync_jobs
          WHERE status = 'queued'
            AND run_at <= NOW()
          ORDER BY run_at ASC, created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        `,
      ) as Array<{ id: number }>;

      const jobId = selectedRows[0]?.id;
      if (!jobId) {
        await queryRunner.rollbackTransaction();
        return null;
      }

      await queryRunner.query(
        `
          UPDATE cloud_sync_jobs
          SET status = 'running',
              locked_at = NOW(),
              locked_by = $2,
              attempt_count = attempt_count + 1,
              updated_at = NOW(),
              finished_at = NULL
          WHERE id = $1
        `,
        [jobId, workerId],
      );

      await queryRunner.commitTransaction();

      return this.jobRepository.findOneBy({ id: jobId });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private appendRecoveryNote(lastError: string | null): string {
    if (!lastError) {
      return 'Recovered stale running job after worker interruption';
    }

    return `${lastError}\nRecovered stale running job after worker interruption`;
  }

  private getRetryDelayMs(attemptCount: number): number {
    return Math.min(30, 2 ** Math.max(0, attemptCount - 1)) * 60_000;
  }

  private extractProviderFromScheduleKey(key: string): CloudProviderType | null {
    if (key === this.settingKey('google_drive', 'sync_enabled')) {
      return 'google_drive';
    }
    if (key === this.settingKey('onedrive', 'sync_enabled')) {
      return 'onedrive';
    }
    if (key === this.settingKey('dropbox', 'sync_enabled')) {
      return 'dropbox';
    }
    return null;
  }

  private settingKey(provider: CloudProviderType, field: string): string {
    return `cloud_${provider}_${field}`;
  }

  async hasActiveJob(userId: number, provider: CloudProviderType): Promise<boolean> {
    const activeJob = await this.jobRepository.findOne({
      where: {
        userId,
        provider,
        status: In(ACTIVE_JOB_STATUSES),
      },
    });

    return !!activeJob;
  }
}