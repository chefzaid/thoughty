import type { DataSource } from 'typeorm';
import { Entry, TimeCapsule } from '@/database/entities';
import { TimeCapsuleService } from './time-capsules.service';

/** A TimeCapsuleService for specs of other features: no entry is sealed, so exports get entries as they are and Highlights has no opened capsule. */
export function noTimeCapsules(): { provide: typeof TimeCapsuleService; useValue: Partial<Record<keyof TimeCapsuleService, jest.Mock>> } {
  return {
    provide: TimeCapsuleService,
    useValue: {
      reveal: jest.fn(async (entries: unknown[]) => entries),
      findRecentlyOpened: jest.fn(async () => []),
      createSealed: jest.fn(),
      openEarly: jest.fn(),
      openCapsule: jest.fn(),
    },
  };
}

/** The real TimeCapsuleService on a PostgreSQL integration spec's database. */
export function timeCapsuleServiceOn(dataSource: DataSource): TimeCapsuleService {
  return new TimeCapsuleService(dataSource.getRepository(TimeCapsule), dataSource.getRepository(Entry));
}
