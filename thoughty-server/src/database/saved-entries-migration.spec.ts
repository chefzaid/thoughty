import type { QueryRunner } from 'typeorm';
import { SavedEntries1788393600000 } from './migrations/1788393600000-saved-entries';

describe('SavedEntries1788393600000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('keeps one save per reader and entry, gone with either', async () => {
    await new SavedEntries1788393600000().up(queryRunner);

    const statement = sql();
    expect(statement).toContain('CREATE TABLE saved_entries');
    expect(statement).toContain('user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(statement).toContain(
      'entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE',
    );
    expect(statement).toContain('PRIMARY KEY (user_id, entry_id)');
    expect(statement).toContain('CREATE INDEX idx_saved_entries_entry ON saved_entries(entry_id)');
  });

  it('drops the saves of an entry the feed may no longer show', async () => {
    await new SavedEntries1788393600000().up(queryRunner);

    const statement = sql();
    // A PIN lock makes the entry private in a BEFORE trigger, which an `UPDATE OF visibility` list would miss
    expect(statement).toContain(
      'AFTER UPDATE OF visibility, is_locked, diary_locked, is_archived, moderation_status, deleted_at\n        ON entries',
    );
    expect(statement).toContain("NEW.visibility <> 'public'");
    expect(statement).toContain('OR NEW.is_archived');
    expect(statement).toContain("OR NEW.moderation_status <> 'visible'");
    expect(statement).toContain('OR NEW.deleted_at IS NOT NULL');
    expect(statement).toContain('DELETE FROM saved_entries WHERE entry_id = NEW.id');
  });

  it('drops the trigger before its function and the table', async () => {
    await new SavedEntries1788393600000().down(queryRunner);

    const statement = sql();
    const order = [
      'DROP TRIGGER IF EXISTS trg_entries_drop_unshown_saves ON entries',
      'DROP FUNCTION IF EXISTS entries_drop_unshown_saves()',
      'DROP TABLE IF EXISTS saved_entries',
    ].map((part) => statement.indexOf(part));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
