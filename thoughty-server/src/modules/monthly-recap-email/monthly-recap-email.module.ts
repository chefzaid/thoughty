import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Diary, MonthlyRecapEmail, User } from '@/database/entities';
import { AuthModule } from '@/modules/auth';
import { UserConfigModule } from '@/modules/config';
import { EntriesModule } from '@/modules/entries';
import { ReviewModule } from '@/modules/review';
import { MonthlyRecapDeliveryWorkerService } from './monthly-recap-delivery-worker.service';
import { MonthlyRecapDeliveryService } from './monthly-recap-delivery.service';
import { MonthlyRecapEmailController } from './monthly-recap-email.controller';
import { MonthlyRecapEmailService } from './monthly-recap-email.service';
import { MonthlyRecapService } from './monthly-recap.service';

@Module({
  imports: [TypeOrmModule.forFeature([MonthlyRecapEmail, Diary, User]), AuthModule, EntriesModule, ReviewModule, UserConfigModule],
  controllers: [MonthlyRecapEmailController],
  providers: [MonthlyRecapEmailService, MonthlyRecapService, MonthlyRecapDeliveryService, MonthlyRecapDeliveryWorkerService],
  exports: [MonthlyRecapDeliveryWorkerService],
})
export class MonthlyRecapEmailModule {}
