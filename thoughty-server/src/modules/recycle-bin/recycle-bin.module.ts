import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachment, Entry } from '@/database/entities';
import { AttachmentsModule } from '@/modules/attachments';
import { UserConfigModule } from '@/modules/config';
import { EntriesModule } from '@/modules/entries';
import { RecycleBinController } from './recycle-bin.controller';
import { RecycleBinPurgeWorkerService } from './recycle-bin-purge-worker.service';
import { RecycleBinService } from './recycle-bin.service';

@Module({
  imports: [TypeOrmModule.forFeature([Entry, Attachment]), AttachmentsModule, EntriesModule, UserConfigModule],
  controllers: [RecycleBinController],
  providers: [RecycleBinService, RecycleBinPurgeWorkerService],
  exports: [RecycleBinPurgeWorkerService],
})
export class RecycleBinModule {}
