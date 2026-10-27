import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entry, TimeCapsule } from '@/database/entities';
import { TimeCapsuleService } from './time-capsules.service';

/** Sealing, opening and revealing time capsules; the entries, exports and the capsule email use it. */
@Module({
  imports: [TypeOrmModule.forFeature([TimeCapsule, Entry])],
  providers: [TimeCapsuleService],
  exports: [TimeCapsuleService],
})
export class TimeCapsulesModule {}
