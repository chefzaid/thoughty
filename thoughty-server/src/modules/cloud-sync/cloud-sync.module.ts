import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from '@/database/entities';
import { IoModule } from '@/modules/io/io.module';
import { CloudSyncController } from './cloud-sync.controller';
import { CloudSyncService } from './cloud-sync.service';
import { GoogleDriveProvider } from './providers/google-drive.provider';
import { OneDriveProvider } from './providers/onedrive.provider';
import { DropboxProvider } from './providers/dropbox.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([Setting]),
    IoModule,
  ],
  controllers: [CloudSyncController],
  providers: [CloudSyncService, GoogleDriveProvider, OneDriveProvider, DropboxProvider],
  exports: [CloudSyncService],
})
export class CloudSyncModule {}
