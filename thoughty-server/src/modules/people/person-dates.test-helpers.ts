import type { DataSource } from 'typeorm';
import { Entry, Person } from '@/database/entities';
import { PersonDatesService } from './person-dates.service';

/** The birthdays and anniversaries service on a test database, as Highlights reads it. */
export function personDatesServiceOn(dataSource: DataSource): PersonDatesService {
  return new PersonDatesService(dataSource.getRepository(Person), dataSource.getRepository(Entry));
}
