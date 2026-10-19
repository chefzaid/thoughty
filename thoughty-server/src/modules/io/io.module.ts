import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entry, Setting, Diary, User, Attachment } from '@/database/entities';
import { AttachmentsModule } from '@/modules/attachments';
import { UserConfigModule } from '@/modules/config';
import { DiariesModule } from '@/modules/diaries';
import { IoController } from './io.controller';
import { IoService } from './io.service';
import { AppImportService } from './app-import.service';
import { MarkdownArchiveService } from './markdown-archive.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Entry, Setting, Diary, User, Attachment]),
    AttachmentsModule,
    DiariesModule,
    UserConfigModule,
  ],
  controllers: [IoController],
  providers: [IoService, AppImportService, MarkdownArchiveService],
  exports: [IoService],
})
export class IoModule {}
