import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Diary, User, WritingReminderEmail } from '@/database/entities';
import { AuthModule } from '@/modules/auth';
import { UserConfigModule } from '@/modules/config';
import { StatsModule } from '@/modules/stats';
import { WritingReminderDeliveryWorkerService } from './writing-reminder-delivery-worker.service';
import { WritingReminderDeliveryService } from './writing-reminder-delivery.service';
import { WritingReminderEmailController } from './writing-reminder-email.controller';
import { WritingReminderEmailService } from './writing-reminder-email.service';

@Module({
  imports: [TypeOrmModule.forFeature([WritingReminderEmail, Diary, User]), AuthModule, StatsModule, UserConfigModule],
  controllers: [WritingReminderEmailController],
  providers: [WritingReminderEmailService, WritingReminderDeliveryService, WritingReminderDeliveryWorkerService],
  exports: [WritingReminderDeliveryWorkerService],
})
export class WritingReminderEmailModule {}
