import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachment, BookVersion, Entry, ShareLink } from '@/database/entities';
import { AttachmentsModule } from '@/modules/attachments';
import { AuthModule } from '@/modules/auth/auth.module';
import { ShareLinksController } from './share-links.controller';
import { ShareLinksService } from './share-links.service';
import { SharedContentController } from './shared-content.controller';
import { SharedContentService } from './shared-content.service';

@Module({
  imports: [TypeOrmModule.forFeature([ShareLink, Entry, Attachment, BookVersion]), AttachmentsModule, AuthModule],
  controllers: [ShareLinksController, SharedContentController],
  providers: [ShareLinksService, SharedContentService],
})
export class ShareLinksModule {}
