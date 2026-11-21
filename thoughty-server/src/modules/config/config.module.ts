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
  WeeklyReflection,
  SavedSearch,
  LifeEra,
  Person,
  TimeCapsule,
  ShareLink,
  ComposerDraft,
  SavedEntry,
  TopicFollow,
  UserMute,
  UserBlock,
} from '@/database/entities';
import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';
import { UserDataExportService } from './user-data-export.service';
import { TimeCapsulesModule } from '@/modules/time-capsules/time-capsules.module';
import { AuthModule } from '@/modules/auth/auth.module';

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
      WeeklyReflection,
      SavedSearch,
      LifeEra,
      Person,
      TimeCapsule,
      ShareLink,
      ComposerDraft,
      SavedEntry,
      TopicFollow,
      UserMute,
      UserBlock,
    ]),
    TimeCapsulesModule,
    AuthModule,
  ],
  controllers: [ConfigController],
  providers: [ConfigService, UserDataExportService],
  exports: [ConfigService, UserDataExportService],
})
export class UserConfigModule {}
