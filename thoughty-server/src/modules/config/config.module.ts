import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Setting,
  User,
  Diary,
  Entry,
  EntryRevision,
  Attachment,
  UserFollow,
  EntryComment,
  EntryLike,
  CommentLike,
  MemoirProgram,
  MemoirAnswer,
  MemoirSnooze,
  OnThisDayEmail,
  MonthlyRecapEmail,
  YearReviewMood,
  SavedSearch,
  LifeEra,
  Person,
  TimeCapsule,
  ShareLink,
  ComposerDraft,
  SavedEntry,
} from '@/database/entities';
import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';
import { UserDataExportService } from './user-data-export.service';
import { TimeCapsulesModule } from '@/modules/time-capsules/time-capsules.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Setting,
      User,
      Diary,
      Entry,
      EntryRevision,
      Attachment,
      UserFollow,
      EntryComment,
      EntryLike,
      CommentLike,
      MemoirProgram,
      MemoirAnswer,
      MemoirSnooze,
      OnThisDayEmail,
      MonthlyRecapEmail,
      YearReviewMood,
      SavedSearch,
      LifeEra,
      Person,
      TimeCapsule,
      ShareLink,
      ComposerDraft,
      SavedEntry,
    ]),
    TimeCapsulesModule,
  ],
  controllers: [ConfigController],
  providers: [ConfigService, UserDataExportService],
  exports: [ConfigService, UserDataExportService],
})
export class UserConfigModule {}
