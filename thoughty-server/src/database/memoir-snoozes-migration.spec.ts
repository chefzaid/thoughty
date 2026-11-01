import type { QueryRunner } from 'typeorm';
import { MemoirSnoozes1787616000000 } from './migrations/1787616000000-memoir-snoozes';

describe('MemoirSnoozes1787616000000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('keeps one return day per set-aside question, removed with the program', async () => {
    await new MemoirSnoozes1787616000000().up(queryRunner);

    expect(sql()).toContain('CREATE TABLE memoir_snoozes');
    expect(sql()).toContain('program_id INTEGER NOT NULL REFERENCES memoir_programs(id) ON DELETE CASCADE');
    expect(sql()).toContain('snoozed_until DATE NOT NULL');
    expect(sql()).toContain('PRIMARY KEY (program_id, question_id)');
  });

  it('drops the table', async () => {
    await new MemoirSnoozes1787616000000().down(queryRunner);

    expect(sql()).toContain('DROP TABLE IF EXISTS memoir_snoozes');
  });
});
