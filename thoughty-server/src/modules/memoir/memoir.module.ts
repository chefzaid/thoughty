import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Diary, MemoirAnswer, MemoirProgram, User } from '@/database/entities';
import { AttachmentsModule } from '@/modules/attachments';
import { AuthModule } from '@/modules/auth';
import { UserConfigModule } from '@/modules/config';
import { DiariesModule } from '@/modules/diaries';
import { EntriesModule } from '@/modules/entries';
import { LifeErasModule } from '@/modules/life-eras';
import { MemoirAnswersService } from './memoir-answers.service';
import { MemoirDeliveryWorkerService } from './memoir-delivery-worker.service';
import { MemoirDeliveryService } from './memoir-delivery.service';
import { MemoirController } from './memoir.controller';
import { MemoirService } from './memoir.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MemoirProgram, MemoirAnswer, Diary, User]),
    AttachmentsModule,
    AuthModule,
    DiariesModule,
    EntriesModule,
    LifeErasModule,
    UserConfigModule,
  ],
  controllers: [MemoirController],
  providers: [MemoirService, MemoirAnswersService, MemoirDeliveryService, MemoirDeliveryWorkerService],
  exports: [MemoirDeliveryWorkerService],
})
export class MemoirModule {}
