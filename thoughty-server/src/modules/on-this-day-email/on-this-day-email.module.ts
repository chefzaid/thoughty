import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Diary, OnThisDayEmail, User } from '@/database/entities';
import { AuthModule } from '@/modules/auth';
import { UserConfigModule } from '@/modules/config';
import { EntriesModule } from '@/modules/entries';
import { OnThisDayDeliveryWorkerService } from './on-this-day-delivery-worker.service';
import { OnThisDayDeliveryService } from './on-this-day-delivery.service';
import { OnThisDayEmailController } from './on-this-day-email.controller';
import { OnThisDayEmailService } from './on-this-day-email.service';

@Module({
  imports: [TypeOrmModule.forFeature([OnThisDayEmail, Diary, User]), AuthModule, EntriesModule, UserConfigModule],
  controllers: [OnThisDayEmailController],
  providers: [OnThisDayEmailService, OnThisDayDeliveryService, OnThisDayDeliveryWorkerService],
  exports: [OnThisDayDeliveryWorkerService],
})
export class OnThisDayEmailModule {}
