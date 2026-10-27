import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonthlyRecapEmail, OnThisDayEmail } from '@/database/entities';
import { EmailUnsubscribeController } from './email-unsubscribe.controller';
import { EmailUnsubscribeService } from './email-unsubscribe.service';

/** What the opt-in emails share at runtime: the one unsubscribe route that turns any of them off. */
@Module({
  imports: [TypeOrmModule.forFeature([OnThisDayEmail, MonthlyRecapEmail])],
  controllers: [EmailUnsubscribeController],
  providers: [EmailUnsubscribeService],
})
export class OptInEmailModule {}
