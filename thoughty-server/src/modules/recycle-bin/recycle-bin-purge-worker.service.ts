import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { RecycleBinService } from './recycle-bin.service';

const PURGE_SCAN_INTERVAL_MS = 60 * 60 * 1000;

/** Empties expired recycle bin entries inside the background worker process, never in API replicas. */
@Injectable()
export class RecycleBinPurgeWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(RecycleBinPurgeWorkerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running: Promise<void> | null = null;
  private stopping = false;

  constructor(private readonly recycleBinService: RecycleBinService) {}

  async start(): Promise<void> {
    this.logger.log('Starting recycle bin cleanup');
    await this.scan();
    if (this.stopping) return;
    this.timer = setInterval(() => {
      void this.scan();
    }, PURGE_SCAN_INTERVAL_MS);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.running;
  }

  private scan(): Promise<void> {
    if (this.stopping || this.running) {
      return this.running ?? Promise.resolve();
    }

    this.running = this.recycleBinService
      .purgeExpired()
      .then((purged) => {
        if (purged > 0) {
          this.logger.log(`Removed ${purged} expired entries from recycle bins`);
        }
      })
      .catch((error: unknown) => {
        this.logger.error('Failed to empty expired recycle bin entries', error instanceof Error ? error.stack : undefined);
      })
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }
}
