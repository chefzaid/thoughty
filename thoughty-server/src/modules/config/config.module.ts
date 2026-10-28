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
  OnThisDayEmail,
  MonthlyRecapEmail,
  YearReviewMood,
  SavedSearch,
  LifeEra,
  Person,
  TimeCapsule,
  ShareLink,
} from '@/database/entities';
import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';
import { UserDataExportService } from './user-data-export.service';
import { FeatureFlagsService } from '@/common';
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
      OnThisDayEmail,
      MonthlyRecapEmail,
      YearReviewMood,
      SavedSearch,
      LifeEra,
      Person,
      TimeCapsule,
      ShareLink,
    ]),
    TimeCapsulesModule,
  ],
  controllers: [ConfigController],
  providers: [ConfigService, FeatureFlagsService, UserDataExportService],
  exports: [ConfigService, FeatureFlagsService, UserDataExportService],
})
export class UserConfigModule {}
