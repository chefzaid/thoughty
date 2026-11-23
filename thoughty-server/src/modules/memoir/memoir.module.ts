import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Diary, MemoirAnswer, MemoirPhotoAnswer, MemoirProgram, MemoirSnooze, User } from '@/database/entities';
import { AiModule } from '@/modules/ai';
import { AttachmentsModule } from '@/modules/attachments';
import { AuthModule } from '@/modules/auth';
import { UserConfigModule } from '@/modules/config';
import { DiariesModule } from '@/modules/diaries';
import { EntriesModule } from '@/modules/entries';
import { LifeErasModule } from '@/modules/life-eras';
import { MemoirAnswersService } from './memoir-answers.service';
import { MemoirFollowUpsService } from './memoir-follow-ups.service';
import { MemoirPhotoAnswersService } from './memoir-photo-answers.service';
import { MemoirDeliveryWorkerService } from './memoir-delivery-worker.service';
import { MemoirDeliveryService } from './memoir-delivery.service';
import { MemoirController } from './memoir.controller';
import { MemoirQuestionsController } from './memoir-questions.controller';
import { MemoirService } from './memoir.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MemoirProgram, MemoirAnswer, MemoirPhotoAnswer, MemoirSnooze, Diary, User]),
    AiModule,
    AttachmentsModule,
    AuthModule,
    DiariesModule,
    EntriesModule,
    LifeErasModule,
    UserConfigModule,
  ],
  controllers: [MemoirController, MemoirQuestionsController],
  providers: [MemoirService, MemoirAnswersService, MemoirFollowUpsService, MemoirPhotoAnswersService, MemoirDeliveryService, MemoirDeliveryWorkerService],
  exports: [MemoirDeliveryWorkerService],
})
export class MemoirModule {}
