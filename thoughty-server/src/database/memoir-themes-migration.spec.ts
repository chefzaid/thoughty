import type { QueryRunner } from 'typeorm';
import { MemoirThemes1788998400000 } from './migrations/1788998400000-memoir-themes';

describe('MemoirThemes1788998400000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = (call: number) => (queryRunner.query as jest.Mock).mock.calls[call][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('gives every memoir program a list of chosen themes, empty for the programs already running', async () => {
    await new MemoirThemes1788998400000().up(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
    expect(sql(0)).toContain("ALTER TABLE memoir_programs ADD COLUMN themes TEXT[] NOT NULL DEFAULT '{}'");
  });

  it('drops the column again', async () => {
    await new MemoirThemes1788998400000().down(queryRunner);

    expect(sql(0)).toContain('ALTER TABLE memoir_programs DROP COLUMN IF EXISTS themes');
  });
});
