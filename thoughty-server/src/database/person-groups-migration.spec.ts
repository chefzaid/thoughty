import type { QueryRunner } from 'typeorm';
import { PersonGroups1789603200000 } from './migrations/1789603200000-person-groups';

describe('PersonGroups1789603200000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('adds the groups of a person, empty by default and never holding a missing or empty name', async () => {
    await new PersonGroups1789603200000().up(queryRunner);

    expect(sql()).toContain("ADD COLUMN groups TEXT[] NOT NULL DEFAULT '{}'");
    expect(sql()).toContain("chk_people_groups_named CHECK (array_position(groups, NULL) IS NULL AND '' <> ALL (groups))");
  });

  it('drops the check and the column', async () => {
    await new PersonGroups1789603200000().down(queryRunner);

    expect(sql()).toContain('DROP CONSTRAINT IF EXISTS chk_people_groups_named');
    expect(sql()).toContain('DROP COLUMN IF EXISTS groups');
  });
});
