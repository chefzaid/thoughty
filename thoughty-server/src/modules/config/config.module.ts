import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting, User, Diary, Entry, EntryRevision, Attachment } from '@/database/entities';
import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';
import { UserDataExportService } from './user-data-export.service';

@Module({
  imports: [TypeOrmModule.forFeature([Setting, User, Diary, Entry, EntryRevision, Attachment])],
  controllers: [ConfigController],
  providers: [ConfigService, UserDataExportService],
  exports: [ConfigService, UserDataExportService],
})
export class UserConfigModule {}
