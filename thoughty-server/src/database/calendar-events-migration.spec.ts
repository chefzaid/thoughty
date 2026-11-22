import type { QueryRunner } from 'typeorm';
import { CalendarEvents1789862400000 } from './migrations/1789862400000-calendar-events';

describe('CalendarEvents1789862400000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = (call: number) => (queryRunner.query as jest.Mock).mock.calls[call][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('keeps one row per event and account, gone with it, either all day or timed', async () => {
    await new CalendarEvents1789862400000().up(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
    expect(sql(0)).toContain('CREATE TABLE calendar_events');
    expect(sql(0)).toContain('user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(sql(0)).toContain('CONSTRAINT uq_calendar_events_user_uid UNIQUE (user_id, uid)');
    expect(sql(0)).toContain('all_day AND start_date IS NOT NULL AND end_date >= start_date AND starts_at IS NULL AND ends_at IS NULL');
    expect(sql(0)).toContain('NOT all_day AND starts_at IS NOT NULL AND ends_at >= starts_at AND start_date IS NULL AND end_date IS NULL');
  });

  it('drops the table', async () => {
    await new CalendarEvents1789862400000().down(queryRunner);

    expect(sql(0)).toBe('DROP TABLE IF EXISTS calendar_events;');
  });
});
