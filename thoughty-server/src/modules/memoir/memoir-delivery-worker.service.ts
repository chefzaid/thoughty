import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { MemoirDeliveryService } from './memoir-delivery.service';

const DELIVERY_SCAN_INTERVAL_MS = 60_000;

/** Runs weekly memoir deliveries inside the background worker process, never in API replicas. */
@Injectable()
export class MemoirDeliveryWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(MemoirDeliveryWorkerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running: Promise<void> | null = null;
  private stopping = false;

  constructor(private readonly memoirDeliveryService: MemoirDeliveryService) {}

  async start(): Promise<void> {
    this.logger.log('Starting weekly memoir delivery');
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

    this.running = this.memoirDeliveryService
      .deliverDueQuestions()
      .then(() => undefined)
      .catch((error: unknown) => {
        this.logger.error('Failed to deliver weekly memoir questions', error instanceof Error ? error.stack : undefined);
      })
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }
}
