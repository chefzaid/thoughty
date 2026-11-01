import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entry, Person } from '@/database/entities';
import { PersonDatesService } from './person-dates.service';

/** Birthdays and anniversaries on the writer's day; Highlights reads them through the service. */
@Module({
  imports: [TypeOrmModule.forFeature([Person, Entry])],
  providers: [PersonDatesService],
  exports: [PersonDatesService],
})
export class PersonDatesModule {}
