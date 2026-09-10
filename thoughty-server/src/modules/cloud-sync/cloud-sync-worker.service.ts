import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { CloudSyncQueueService } from './cloud-sync-queue.service';

const SCHEDULE_SCAN_INTERVAL_MS = 60_000;
const JOB_POLL_INTERVAL_MS = 5_000;
const MAX_JOBS_PER_TICK = 5;

@Injectable()
export class CloudSyncWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(CloudSyncWorkerService.name);
  private readonly workerId = `${hostname()}:${process.pid}:${randomUUID()}`;
  private scheduleScanTimer: ReturnType<typeof setInterval> | null = null;
  private jobPollTimer: ReturnType<typeof setInterval> | null = null;
  private scanningSchedules = false;
  private processingJobs = false;
  private stopping = false;
  private readonly activeTasks = new Set<Promise<void>>();

  constructor(private readonly cloudSyncQueueService: CloudSyncQueueService) {}

  async start(): Promise<void> {
    this.logger.log(`Starting cloud sync worker ${this.workerId}`);

    await this.track(this.scanSchedules());
    await this.track(this.processJobs());
    if (this.stopping) return;

    this.scheduleScanTimer = setInterval(() => {
      void this.track(this.scanSchedules());
    }, SCHEDULE_SCAN_INTERVAL_MS);

    this.jobPollTimer = setInterval(() => {
      void this.track(this.processJobs());
    }, JOB_POLL_INTERVAL_MS);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    this.cloudSyncQueueService.stop();
    if (this.scheduleScanTimer) {
      clearInterval(this.scheduleScanTimer);
      this.scheduleScanTimer = null;
    }

    if (this.jobPollTimer) {
      clearInterval(this.jobPollTimer);
      this.jobPollTimer = null;
    }
    await Promise.allSettled(this.activeTasks);
  }

  private track(task: Promise<void>): Promise<void> {
    this.activeTasks.add(task);
    void task.finally(() => this.activeTasks.delete(task));
    return task;
  }

  private async scanSchedules(): Promise<void> {
    if (this.stopping || this.scanningSchedules) {
      return;
    }

    this.scanningSchedules = true;

    try {
      await this.cloudSyncQueueService.enqueueDueSyncJobs();
    } catch (error) {
      this.logger.error('Failed to enqueue due cloud sync jobs', error instanceof Error ? error.stack : undefined);
    } finally {
      this.scanningSchedules = false;
    }
  }

  private async processJobs(): Promise<void> {
    if (this.stopping || this.processingJobs) {
      return;
    }

    this.processingJobs = true;

    try {
      await this.cloudSyncQueueService.recoverStaleJobs();
      await this.cloudSyncQueueService.processAvailableJobs(this.workerId, MAX_JOBS_PER_TICK);
    } catch (error) {
      this.logger.error('Failed to process queued cloud sync jobs', error instanceof Error ? error.stack : undefined);
    } finally {
      this.processingJobs = false;
    }
  }
}
