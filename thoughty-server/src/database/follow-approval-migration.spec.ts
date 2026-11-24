import type { QueryRunner } from 'typeorm';
import { FollowApproval1790553600000 } from './migrations/1790553600000-follow-approval';

describe('FollowApproval1790553600000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('adds the switch, off for every account, and keeps every follow approved', async () => {
    await new FollowApproval1790553600000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('ADD COLUMN followers_by_approval BOOLEAN NOT NULL DEFAULT false');
    expect(sql).toContain("ADD COLUMN status VARCHAR(8) NOT NULL DEFAULT 'approved'");
    expect(sql).toContain("CHECK (status IN ('approved', 'pending'))");
    expect(sql).toContain("WHERE status = 'pending'");
  });

  it('drops the waiting requests before the columns, so none becomes a follow', async () => {
    await new FollowApproval1790553600000().down(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql.indexOf("DELETE FROM user_follows WHERE status = 'pending'")).toBeLessThan(
      sql.indexOf('DROP COLUMN IF EXISTS status'),
    );
    expect(sql).toContain('DROP COLUMN IF EXISTS followers_by_approval');
  });
});
