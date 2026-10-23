import { Module } from '@nestjs/common';
import { AttachmentsModule } from '@/modules/attachments';
import { AccountPurgeService } from './account-purge.service';
import { AccountPurgeWorkerService } from './account-purge-worker.service';

@Module({
  imports: [AttachmentsModule],
  providers: [AccountPurgeService, AccountPurgeWorkerService],
  exports: [AccountPurgeWorkerService],
})
export class AccountPurgeModule {}
