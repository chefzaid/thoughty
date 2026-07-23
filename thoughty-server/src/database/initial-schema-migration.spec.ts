import type { QueryRunner } from 'typeorm';
import { InitialSchema1784764800000 } from './migrations/1784764800000-initial-schema';

describe('InitialSchema1784764800000', () => {
  const queryRunner = {
    query: jest.fn(),
  } as unknown as QueryRunner;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies the complete schema in one versioned operation', async () => {
    await new InitialSchema1784764800000().up(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS users'));
    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS entries'));
    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS cloud_sync_jobs'));
    expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining('idx_entries_tags_gin'));
  });

  it('removes schema objects in dependency-safe order', async () => {
    await new InitialSchema1784764800000().down(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql.indexOf('DROP TABLE IF EXISTS entries')).toBeLessThan(sql.indexOf('DROP TABLE IF EXISTS diaries'));
    expect(sql.indexOf('DROP TABLE IF EXISTS diaries')).toBeLessThan(sql.indexOf('DROP TABLE IF EXISTS users'));
  });
});
