import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudSyncJob, Setting } from '@/database/entities';
import { IoModule } from '@/modules/io/io.module';
import { CloudSyncController } from './cloud-sync.controller';
import { CloudSyncQueueService } from './cloud-sync-queue.service';
import { CloudSyncService } from './cloud-sync.service';
import { CloudSyncWorkerService } from './cloud-sync-worker.service';
import { GoogleDriveProvider } from './providers/google-drive.provider';
import { OneDriveProvider } from './providers/onedrive.provider';
import { DropboxProvider } from './providers/dropbox.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([Setting, CloudSyncJob]),
    IoModule,
  ],
  controllers: [CloudSyncController],
  providers: [
    CloudSyncService,
    CloudSyncQueueService,
    CloudSyncWorkerService,
    GoogleDriveProvider,
    OneDriveProvider,
    DropboxProvider,
  ],
  exports: [CloudSyncService, CloudSyncQueueService, CloudSyncWorkerService],
})
export class CloudSyncModule {}
