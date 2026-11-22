import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Diary, DiaryWritingReminder, User, WritingReminderEmail } from '@/database/entities';
import { AuthModule } from '@/modules/auth';
import { UserConfigModule } from '@/modules/config';
import { StatsModule } from '@/modules/stats';
import { DiaryWritingReminderDeliveryService } from './diary-writing-reminder-delivery.service';
import { DiaryWritingReminderService } from './diary-writing-reminder.service';
import { WritingReminderDeliveryWorkerService } from './writing-reminder-delivery-worker.service';
import { WritingReminderDeliveryService } from './writing-reminder-delivery.service';
import { WritingReminderEmailController } from './writing-reminder-email.controller';
import { WritingReminderEmailService } from './writing-reminder-email.service';

@Module({
  imports: [TypeOrmModule.forFeature([WritingReminderEmail, DiaryWritingReminder, Diary, User]), AuthModule, StatsModule, UserConfigModule],
  controllers: [WritingReminderEmailController],
  providers: [
    WritingReminderEmailService,
    DiaryWritingReminderService,
    WritingReminderDeliveryService,
    DiaryWritingReminderDeliveryService,
    WritingReminderDeliveryWorkerService,
  ],
  exports: [WritingReminderDeliveryWorkerService],
})
export class WritingReminderEmailModule {}
