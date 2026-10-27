import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { JsonLogger } from './common';
import { CloudSyncWorkerService } from './modules/cloud-sync/cloud-sync-worker.service';
import { MemoirDeliveryWorkerService } from './modules/memoir/memoir-delivery-worker.service';
import { OnThisDayDeliveryWorkerService } from './modules/on-this-day-email/on-this-day-delivery-worker.service';
import { RecycleBinPurgeWorkerService } from './modules/recycle-bin/recycle-bin-purge-worker.service';
import { AccountPurgeWorkerService } from './modules/account-purge/account-purge-worker.service';

const logger = new JsonLogger('CloudSyncWorkerBootstrap');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger,
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.log(`Received ${signal}, shutting down cloud sync worker`);
    await app.close();
    process.exit(0);
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  await app.get(CloudSyncWorkerService).start();
  await app.get(MemoirDeliveryWorkerService).start();
  await app.get(OnThisDayDeliveryWorkerService).start();
  await app.get(RecycleBinPurgeWorkerService).start();
  await app.get(AccountPurgeWorkerService).start();
}

bootstrap().catch((error: unknown) => {
  logger.error('Failed to start cloud sync worker', error instanceof Error ? error.stack : undefined);
  process.exit(1);
});
