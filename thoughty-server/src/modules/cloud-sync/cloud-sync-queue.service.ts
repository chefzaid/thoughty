import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, LessThanOrEqual, Raw, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { CloudSyncJob, type CloudSyncJobStatus, Setting } from '@/database/entities';
import type { CloudProviderType } from './dto';
import { CloudSyncService } from './cloud-sync.service';
import { withCloudOperation } from './providers/cloud-operation';

const CLOUD_SYNC_PROVIDERS: CloudProviderType[] = ['google_drive', 'onedrive', 'dropbox'];
const ACTIVE_JOB_STATUSES: CloudSyncJobStatus[] = ['queued', 'running'];
const DEFAULT_MAX_ATTEMPTS = 3;
const JOB_LOCK_TIMEOUT_MS = 15 * 60 * 1000;
const JOB_HEARTBEAT_MS = 30_000;

@Injectable()
export class CloudSyncQueueService {
  private readonly logger = new Logger(CloudSyncQueueService.name);
  private stopping = false;
  private readonly activeOperations = new Set<AbortController>();

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

  async recoverStaleJobs(now?: Date): Promise<number> {
    const stale = now ? LessThanOrEqual(new Date(now.getTime() - JOB_LOCK_TIMEOUT_MS))
      : Raw(alias => `${alias} <= NOW() - INTERVAL '15 minutes'`);
    const recoveredAt = now ?? new Date();
    const staleJobs = await this.jobRepository.find({
      where: {
        status: 'running',
        lockedAt: stale,
      },
    });

    let recovered = 0;
    for (const job of staleJobs) {
      const canRetry = job.attemptCount < job.maxAttempts;
      const result = await this.jobRepository.update({
        id: job.id, status: 'running', lockedBy: job.lockedBy ?? IsNull(),
        lockedAt: stale,
      }, {
        status: canRetry ? 'queued' : 'failed',
        runAt: canRetry ? recoveredAt : job.runAt,
        lockedAt: null,
        lockedBy: null,
        finishedAt: canRetry ? null : recoveredAt,
        lastError: this.appendRecoveryNote(job.lastError),
      });
      recovered += result.affected ?? 0;
    }

    return recovered;
  }

  async processAvailableJobs(workerId: string, maxJobs = 5): Promise<number> {
    let processedCount = 0;

    while (!this.stopping && processedCount < maxJobs) {
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
    const controller = new AbortController();
    this.activeOperations.add(controller);
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let renewing: Promise<void> | undefined;
    const verifyOwnership = async () => {
      controller.signal.throwIfAborted();
      try {
        const rows = await this.dataSource.query(`UPDATE cloud_sync_jobs SET locked_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND status = 'running' AND locked_by = $2
            AND locked_at > NOW() - INTERVAL '15 minutes' RETURNING id`, [job.id, job.lockedBy]) as Array<{ id: number }>;
        if (!rows.length) throw new Error('Cloud sync lease lost');
      } catch (error) {
        controller.abort(new Error('Cloud sync lease lost'));
        throw error;
      }
      controller.signal.throwIfAborted();
    };
    try {
      if (this.stopping) controller.abort(new Error('Cloud sync worker stopping'));
      await verifyOwnership();
      heartbeat = setInterval(() => {
        if (renewing) return;
        renewing = verifyOwnership().catch(() => {}).finally(() => { renewing = undefined; });
      }, JOB_HEARTBEAT_MS);
      heartbeat.unref();
      const result = await withCloudOperation({ signal: controller.signal, verifyOwnership },
        () => this.cloudSyncService.executeDiffSync(job.userId, job.provider));
      controller.signal.throwIfAborted();
      await this.jobRepository.update(this.ownershipCriteria(job), {
        status: 'completed',
        lockedAt: null,
        lockedBy: null,
        finishedAt: new Date(),
        lastError: null,
        resultMessage: result.message,
      });
    } catch (error) {
      if (!controller.signal.aborted) await this.failJob(job, error);
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      await renewing;
      this.activeOperations.delete(controller);
    }
  }

  stop(): void {
    this.stopping = true;
    for (const controller of this.activeOperations) controller.abort(new Error('Cloud sync worker stopping'));
  }

  private ownershipCriteria(job: CloudSyncJob) {
    return { id: job.id, status: 'running' as const, lockedBy: job.lockedBy ?? IsNull(),
      lockedAt: Raw(alias => `${alias} > NOW() - INTERVAL '15 minutes'`) };
  }

  private async failJob(job: CloudSyncJob, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown cloud sync failure';
    const canRetry = job.attemptCount < job.maxAttempts;
    const retryAt = new Date(Date.now() + this.getRetryDelayMs(job.attemptCount));

    const update = await this.jobRepository.update(this.ownershipCriteria(job), {
      status: canRetry ? 'queued' : 'failed',
      runAt: canRetry ? retryAt : job.runAt,
      lockedAt: null,
      lockedBy: null,
      finishedAt: canRetry ? null : new Date(),
      lastError: errorMessage,
      resultMessage: null,
    });

    if (!update.affected) return;
    this.logger.error(
      `Cloud sync job ${job.id} failed for user ${job.userId} and provider ${job.provider}: ${errorMessage}`,
    );
  }

  private async claimNextJob(workerId: string): Promise<CloudSyncJob | null> {
    const claimToken = `${workerId.slice(0, 80)}:${randomUUID()}`;
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
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
        [jobId, claimToken],
      );

      await queryRunner.commitTransaction();

      const job = await this.jobRepository.findOneBy({ id: jobId, status: 'running', lockedBy: claimToken });
      if (job) job.lockedBy = claimToken;
      return job;
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
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
