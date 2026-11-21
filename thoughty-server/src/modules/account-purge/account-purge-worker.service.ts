import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { AccountActivityService } from '@/modules/auth/account-activity/account-activity.service';
import { AccountPurgeService } from './account-purge.service';

const PURGE_SCAN_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Purges deleted accounts past their grace period, sign-up requests whose link expired, and account
 * activity older than a year, inside the background worker process, never in API replicas.
 */
@Injectable()
export class AccountPurgeWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(AccountPurgeWorkerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running: Promise<void> | null = null;
  private stopping = false;

  constructor(
    private readonly accountPurgeService: AccountPurgeService,
    private readonly accountActivity: AccountActivityService,
  ) {}

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

  /** Removes what has expired (`what`, for the log); a failure is logged and does not hold up the account purge. */
  private async removeExpired(what: string, remove: () => Promise<number>): Promise<void> {
    try {
      const removed = await remove();
      if (removed > 0) {
        this.logger.log(`Removed ${removed} ${what}`);
      }
    } catch (error) {
      this.logger.error(`Failed to remove ${what}`, error instanceof Error ? error.stack : undefined);
    }
  }

  /** Logs only counts and user ids, never anything that identifies the person behind an account. */
  private scan(): Promise<void> {
    if (this.stopping || this.running) {
      return this.running ?? Promise.resolve();
    }

    this.running = this.removeExpired('expired sign-up requests', () => this.accountPurgeService.purgeExpiredSignUps())
      .then(() => this.removeExpired('account activity events older than a year', () => this.accountActivity.purgeExpired()))
      .then(() => this.accountPurgeService.purgeExpired())
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
