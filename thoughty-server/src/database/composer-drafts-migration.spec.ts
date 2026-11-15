import type { QueryRunner } from 'typeorm';
import { ComposerDrafts1787875200000 } from './migrations/1787875200000-composer-drafts';

describe('ComposerDrafts1787875200000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('keeps one draft per writer, gone with the account, within the entry limits and with a revision', async () => {
    await new ComposerDrafts1787875200000().up(queryRunner);

    const statement = sql();
    expect(statement).toContain('CREATE TABLE composer_drafts');
    expect(statement).toContain('user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE');
    expect(statement).toContain('title VARCHAR(200)');
    expect(statement).toContain('content TEXT NOT NULL');
    expect(statement).toContain('CHECK (char_length(content) <= 50000)');
    expect(statement).toContain("CHECK (format IN ('plain', 'markdown'))");
    expect(statement).toContain('CHECK (mood IS NULL OR mood BETWEEN 1 AND 5)');
    expect(statement).toContain('revision INTEGER NOT NULL DEFAULT 1');
    expect(statement).toContain('CHECK (revision >= 1)');
  });

  it('drops the table', async () => {
    await new ComposerDrafts1787875200000().down(queryRunner);

    expect(sql()).toBe('DROP TABLE IF EXISTS composer_drafts');
  });
});
