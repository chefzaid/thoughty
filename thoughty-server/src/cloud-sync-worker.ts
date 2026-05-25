import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CloudSyncWorkerService } from './modules/cloud-sync/cloud-sync-worker.service';

const logger = new Logger('CloudSyncWorkerBootstrap');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const shutdown = async (signal: string) => {
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
}

bootstrap().catch((error: unknown) => {
  logger.error('Failed to start cloud sync worker', error instanceof Error ? error.stack : undefined);
  process.exit(1);
});