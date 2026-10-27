import { Logger, type OnModuleDestroy } from '@nestjs/common';

const DELIVERY_SCAN_INTERVAL_MS = 60_000;

/**
 * Sends one kind of opt-in email that is due every minute inside the background worker process, never in
 * API replicas. Runs never overlap, and shutting down waits for the current one.
 */
export abstract class OptInEmailWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(this.constructor.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running: Promise<void> | null = null;
  private stopping = false;

  /**
   * @param label how logs name the email, as in "Sent 3 <label> emails".
   */
  protected constructor(
    private readonly deliveryService: { deliverDue(): Promise<number> },
    private readonly label: string,
  ) {}

  async start(): Promise<void> {
    this.logger.log(`Starting ${this.label} email delivery`);
    await this.scan();
    if (this.stopping) return;
    this.timer = setInterval(() => {
      void this.scan();
    }, DELIVERY_SCAN_INTERVAL_MS);
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

    this.running = this.deliveryService
      .deliverDue()
      .then((sent) => {
        if (sent > 0) {
          this.logger.log(`Sent ${sent} ${this.label} emails`);
        }
      })
      .catch((error: unknown) => {
        this.logger.error(`Failed to deliver ${this.label} emails`, error instanceof Error ? error.stack : undefined);
      })
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }
}
