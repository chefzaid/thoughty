import type { DataSource } from 'typeorm';
import { Entry } from '@/database/entities';
import { RereadReminderService } from './reread-reminders.service';

/** The reread reminder service on a test database, as Highlights reads it. */
export function rereadReminderServiceOn(dataSource: DataSource): RereadReminderService {
  return new RereadReminderService(dataSource.getRepository(Entry));
}
