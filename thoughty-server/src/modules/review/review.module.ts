import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachment, Diary, Entry, YearReviewMood } from '@/database/entities';
import { AiModule } from '@/modules/ai';
import { ReviewController } from './review.controller';
import { YearMoodService } from './year-mood.service';
import { YearReviewService } from './year-review.service';

@Module({
  imports: [TypeOrmModule.forFeature([Entry, Diary, Attachment, YearReviewMood]), AiModule],
  controllers: [ReviewController],
  providers: [YearReviewService, YearMoodService],
  exports: [YearReviewService],
})
export class ReviewModule {}
