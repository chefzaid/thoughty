import type { QueryRunner } from 'typeorm';
import { EntryLocation1790726400000 } from './migrations/1790726400000-entry-location';

describe('EntryLocation1790726400000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('adds the place name and the coordinates, both or neither and each within its range', async () => {
    await new EntryLocation1790726400000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('ADD COLUMN location_name VARCHAR(200)');
    expect(sql).toContain('ADD COLUMN latitude DOUBLE PRECISION');
    expect(sql).toContain('ADD COLUMN longitude DOUBLE PRECISION');
    expect(sql).toContain('(latitude IS NULL AND longitude IS NULL)');
    // A lone coordinate makes the range check unknown, which a CHECK lets through unless both are required
    expect(sql).toContain('latitude IS NOT NULL AND longitude IS NOT NULL');
    expect(sql).toContain('latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180');
  });

  it('drops the constraint before the columns it reads', async () => {
    await new EntryLocation1790726400000().down(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql.indexOf('DROP CONSTRAINT IF EXISTS chk_entries_coordinates')).toBeLessThan(sql.indexOf('DROP COLUMN IF EXISTS latitude'));
    expect(sql).toContain('DROP COLUMN IF EXISTS location_name');
    expect(sql).toContain('DROP COLUMN IF EXISTS longitude');
  });
});
