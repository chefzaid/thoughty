import type { QueryRunner } from 'typeorm';
import { CalendarEventRecurrence1789948800000 } from './migrations/1789948800000-calendar-event-recurrence';

describe('CalendarEventRecurrence1789948800000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = (call: number) => (queryRunner.query as jest.Mock).mock.calls[call][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('adds how an event repeats, null for the events already imported', async () => {
    await new CalendarEventRecurrence1789948800000().up(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
    expect(sql(0)).toBe('ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS recurrence JSONB;');
  });

  it('drops the column', async () => {
    await new CalendarEventRecurrence1789948800000().down(queryRunner);

    expect(sql(0)).toBe('ALTER TABLE calendar_events DROP COLUMN IF EXISTS recurrence;');
  });
});
