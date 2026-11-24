import type { QueryRunner } from 'typeorm';
import { SignUpRequestPreferences1790467200000 } from './migrations/1790467200000-sign-up-request-preferences';

describe('SignUpRequestPreferences1790467200000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('adds an optional language and theme to the waiting sign-ups', async () => {
    await new SignUpRequestPreferences1790467200000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('ALTER TABLE sign_up_requests ADD COLUMN language VARCHAR(2);');
    expect(sql).toContain('ALTER TABLE sign_up_requests ADD COLUMN theme VARCHAR(5);');
    expect(sql).not.toContain('NOT NULL');
  });

  it('drops both columns', async () => {
    await new SignUpRequestPreferences1790467200000().down(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('DROP COLUMN IF EXISTS theme');
    expect(sql).toContain('DROP COLUMN IF EXISTS language');
  });
});
