import type { QueryRunner } from 'typeorm';
import { LifeEras1786579200000 } from './migrations/1786579200000-life-eras';

describe('LifeEras1786579200000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('keeps life eras per writer with one name each, an optional end and a valid range', async () => {
    await new LifeEras1786579200000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE life_eras');
    expect(sql).toContain('user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(sql).toContain('name VARCHAR(50) NOT NULL');
    expect(sql).toContain('start_date DATE NOT NULL');
    expect(sql).toMatch(/end_date DATE,/);
    expect(sql).toContain("CHECK (btrim(name) <> '')");
    expect(sql).toContain('CHECK (end_date IS NULL OR end_date >= start_date)');
    expect(sql).toContain("CHECK (color IS NULL OR color ~ '^#[0-9A-F]{6}$')");
    expect(sql).toMatch(/CREATE UNIQUE INDEX uq_life_eras_user_name ON life_eras\(user_id, lower\(name\)\)/);
    expect(sql).toContain('CREATE INDEX idx_life_eras_user_start ON life_eras(user_id, start_date)');
  });

  it('drops the table', async () => {
    await new LifeEras1786579200000().down(queryRunner);

    expect((queryRunner.query as jest.Mock).mock.calls[0][0]).toContain('DROP TABLE IF EXISTS life_eras');
  });
});
