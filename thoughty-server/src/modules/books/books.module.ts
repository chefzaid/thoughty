import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entry, Diary, User } from '@/database/entities';
import { AiModule } from '@/modules/ai';
import { CloudSyncModule } from '@/modules/cloud-sync';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

@Module({
  imports: [AiModule, CloudSyncModule, TypeOrmModule.forFeature([Entry, Diary, User])],
  controllers: [BooksController],
  providers: [BooksService],
  exports: [BooksService],
})
export class BooksModule {}
