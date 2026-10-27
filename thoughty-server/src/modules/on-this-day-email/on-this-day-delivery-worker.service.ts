import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { OnThisDayDeliveryService } from './on-this-day-delivery.service';

const DELIVERY_SCAN_INTERVAL_MS = 60_000;

/** Sends the due "On this day" emails every minute inside the background worker process, never in API replicas. */
@Injectable()
export class OnThisDayDeliveryWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(OnThisDayDeliveryWorkerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running: Promise<void> | null = null;
  private stopping = false;

  constructor(private readonly deliveryService: OnThisDayDeliveryService) {}

  async start(): Promise<void> {
    this.logger.log('Starting On this day email delivery');
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
          this.logger.log(`Sent ${sent} On this day emails`);
        }
      })
      .catch((error: unknown) => {
        this.logger.error('Failed to deliver On this day emails', error instanceof Error ? error.stack : undefined);
      })
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }
}
