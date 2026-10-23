import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { AccountPurgeService } from './account-purge.service';

const PURGE_SCAN_INTERVAL_MS = 60 * 60 * 1000;

/** Purges deleted accounts past their grace period inside the background worker process, never in API replicas. */
@Injectable()
export class AccountPurgeWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(AccountPurgeWorkerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running: Promise<void> | null = null;
  private stopping = false;

  constructor(private readonly accountPurgeService: AccountPurgeService) {}

  async start(): Promise<void> {
    this.logger.log(`Starting deleted account purge after ${this.accountPurgeService.purgeAfterDays} days`);
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

  /** Logs only counts and user ids, never anything that identifies the person behind an account. */
  private scan(): Promise<void> {
    if (this.stopping || this.running) {
      return this.running ?? Promise.resolve();
    }

    this.running = this.accountPurgeService
      .purgeExpired()
      .then(({ purgedUserIds, failedUserIds }) => {
        if (purgedUserIds.length > 0) {
          this.logger.log(`Purged ${purgedUserIds.length} deleted accounts: ${purgedUserIds.join(', ')}`);
        }
        if (failedUserIds.length > 0) {
          this.logger.warn(`Could not purge ${failedUserIds.length} deleted accounts: ${failedUserIds.join(', ')}`);
        }
      })
      .catch((error: unknown) => {
        this.logger.error('Failed to purge deleted accounts', error instanceof Error ? error.stack : undefined);
      })
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }
}
