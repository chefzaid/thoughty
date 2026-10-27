import type { QueryRunner } from 'typeorm';
import { EntryListVersions1787270400000 } from './migrations/1787270400000-entry-list-versions';

const LIST_TABLES = ['entries', 'diaries', 'attachments', 'life_eras', 'entry_people'];

describe('EntryListVersions1787270400000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const statements = () => (queryRunner.query as jest.Mock).mock.calls.map(([sql]) => sql as string);

  beforeEach(() => jest.clearAllMocks());

  it('keeps one version per writer, bumped once per transaction and never for a writer who is gone', async () => {
    await new EntryListVersions1787270400000().up(queryRunner);

    const [schema] = statements();
    expect(schema).toContain('CREATE TABLE entry_list_versions');
    expect(schema).toContain('user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE');
    expect(schema).toContain('version BIGINT NOT NULL DEFAULT 1');
    expect(schema).toContain('SELECT u.id, pg_current_xact_id() FROM users u WHERE u.id = writer');
    expect(schema).toMatch(/ON CONFLICT \(user_id\) DO UPDATE\s+SET version = v\.version \+ 1, changed_by = EXCLUDED\.changed_by\s+WHERE v\.changed_by <> EXCLUDED\.changed_by/);
    expect(schema).toContain('PERFORM bump_entry_list_version((SELECT user_id FROM entries WHERE id = NEW.entry_id))');
    expect(schema).toContain('PERFORM bump_entry_list_version(OLD.user_id)');
  });

  it('bumps it from a deferred row trigger on every table the journal list reads', async () => {
    await new EntryListVersions1787270400000().up(queryRunner);

    const triggers = statements().slice(1);
    expect(triggers).toHaveLength(LIST_TABLES.length);
    LIST_TABLES.forEach((table, position) => {
      expect(triggers[position]).toMatch(
        new RegExp(
          `CREATE CONSTRAINT TRIGGER trg_${table}_entry_list_version\\s+AFTER INSERT OR UPDATE OR DELETE ON ${table}\\s+DEFERRABLE INITIALLY DEFERRED\\s+FOR EACH ROW EXECUTE FUNCTION entry_list_changed\\(\\)`,
        ),
      );
    });
  });

  it('drops the triggers, then the functions and the table', async () => {
    await new EntryListVersions1787270400000().down(queryRunner);

    const sql = statements();
    expect(sql.slice(0, LIST_TABLES.length)).toEqual(
      [...LIST_TABLES].reverse().map((table) => `DROP TRIGGER IF EXISTS trg_${table}_entry_list_version ON ${table}`),
    );
    const rest = sql.at(-1)!;
    const order = [
      'DROP FUNCTION IF EXISTS entry_list_changed()',
      'DROP FUNCTION IF EXISTS bump_entry_list_version(INTEGER)',
      'DROP TABLE IF EXISTS entry_list_versions',
    ].map((statement) => rest.indexOf(statement));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
  });
});
