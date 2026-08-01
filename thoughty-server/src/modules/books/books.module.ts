import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookVersion, Entry, Diary, User } from '@/database/entities';
import { AiModule } from '@/modules/ai';
import { CloudSyncModule } from '@/modules/cloud-sync';
import { AttachmentsModule } from '@/modules/attachments';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { BookVersionsService } from './book-versions.service';

@Module({
  imports: [
    AiModule,
    AttachmentsModule,
    CloudSyncModule,
    TypeOrmModule.forFeature([BookVersion, Entry, Diary, User]),
  ],
  controllers: [BooksController],
  providers: [BooksService, BookVersionsService],
  exports: [BooksService],
})
export class BooksModule {}
