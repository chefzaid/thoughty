import type { QueryRunner } from 'typeorm';
import { PersonReachOut1789430400000 } from './migrations/1789430400000-person-reach-out';

describe('PersonReachOut1789430400000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('adds an optional reminder interval of at most a year and the day of the last contact, with an index over the people who have a reminder', async () => {
    await new PersonReachOut1789430400000().up(queryRunner);

    expect(sql()).toContain('ADD COLUMN reach_out_days SMALLINT');
    expect(sql()).toContain('ADD COLUMN last_contact_on DATE');
    expect(sql()).toContain('chk_people_reach_out_days CHECK (reach_out_days BETWEEN 1 AND 366)');
    expect(sql()).toContain('CREATE INDEX idx_people_user_reach_out ON people(user_id) WHERE reach_out_days IS NOT NULL');
  });

  it('drops the index, the check and the columns', async () => {
    await new PersonReachOut1789430400000().down(queryRunner);

    expect(sql()).toContain('DROP INDEX IF EXISTS idx_people_user_reach_out');
    expect(sql()).toContain('DROP CONSTRAINT IF EXISTS chk_people_reach_out_days');
    expect(sql()).toContain('DROP COLUMN IF EXISTS last_contact_on');
    expect(sql()).toContain('DROP COLUMN IF EXISTS reach_out_days');
  });
});
