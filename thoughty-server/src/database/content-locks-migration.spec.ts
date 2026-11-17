import type { QueryRunner } from 'typeorm';
import { ContentLocks1788307200000 } from './migrations/1788307200000-content-locks';

describe('ContentLocks1788307200000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('keeps one hashed PIN per writer with its wrong tries, and unlocks by token hash', async () => {
    await new ContentLocks1788307200000().up(queryRunner);

    const statement = sql();
    expect(statement).toContain('CREATE TABLE content_pins');
    expect(statement).toContain('user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE');
    expect(statement).toContain('pin_hash VARCHAR(100) NOT NULL');
    expect(statement).toContain('failed_attempts INTEGER NOT NULL DEFAULT 0');
    expect(statement).toContain('blocked_until TIMESTAMPTZ');
    expect(statement).toContain('CREATE TABLE content_unlocks');
    expect(statement).toContain("CHECK (token_hash ~ '^[0-9a-f]{64}$')");
    expect(statement).toContain('CREATE UNIQUE INDEX uq_content_unlocks_token_hash ON content_unlocks(token_hash)');
  });

  it('adds the lock flags and keeps each entry’s copy of its diary’s flag in step', async () => {
    await new ContentLocks1788307200000().up(queryRunner);

    const statement = sql();
    expect(statement).toContain('ALTER TABLE diaries ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT false');
    expect(statement).toContain('ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT false');
    expect(statement).toContain('ADD COLUMN diary_locked BOOLEAN NOT NULL DEFAULT false');
    expect(statement).toContain('BEFORE INSERT OR UPDATE OF diary_id, diary_locked, is_locked, visibility ON entries');
    expect(statement).toContain("IF NEW.is_locked OR NEW.diary_locked THEN\n          NEW.visibility := 'private';");
    expect(statement).toContain('SELECT d.is_locked FROM diaries d WHERE d.id = NEW.diary_id');
    expect(statement).toContain('AFTER UPDATE OF is_locked ON diaries');
    expect(statement).toContain('UPDATE entries SET diary_locked = NEW.is_locked WHERE diary_id = NEW.id');
  });

  it('drops the triggers before the columns and the tables', async () => {
    await new ContentLocks1788307200000().down(queryRunner);

    const statement = sql();
    const order = [
      'DROP TRIGGER IF EXISTS trg_diaries_lock_entries',
      'DROP TRIGGER IF EXISTS trg_entries_copy_diary_lock',
      'DROP COLUMN IF EXISTS diary_locked',
      'DROP TABLE IF EXISTS content_unlocks',
      'DROP TABLE IF EXISTS content_pins',
    ].map((part) => statement.indexOf(part));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
