import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookVersion, Entry, Diary, User } from '@/database/entities';
import { EntriesModule } from '@/modules/entries';
import { SavedSearchesModule } from '@/modules/saved-searches';
import { AiModule } from '@/modules/ai';
import { CloudSyncModule } from '@/modules/cloud-sync';
import { AttachmentsModule } from '@/modules/attachments';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { BookVersionsService } from './book-versions.service';
import { BookEntrySourceService } from './book-entry-source.service';

@Module({
  imports: [
    AiModule,
    AttachmentsModule,
    CloudSyncModule,
    EntriesModule,
    SavedSearchesModule,
    TypeOrmModule.forFeature([BookVersion, Entry, Diary, User]),
  ],
  controllers: [BooksController],
  providers: [BooksService, BookVersionsService, BookEntrySourceService],
  exports: [BooksService],
})
export class BooksModule {}
