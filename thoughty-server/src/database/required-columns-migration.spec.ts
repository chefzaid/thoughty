import type { QueryRunner } from 'typeorm';
import { RequiredColumns1787184000000 } from './migrations/1787184000000-required-columns';

describe('RequiredColumns1787184000000', () => {
  const query = jest.fn();
  const queryRunner = { query } as unknown as QueryRunner;
  const statements = () => query.mock.calls.map(([sql]) => String(sql));

  beforeEach(() => jest.clearAllMocks());

  it('locks the tables, fills each null with its default before requiring a value, and gives diary icons their default', async () => {
    await new RequiredColumns1787184000000().up(queryRunner);

    const sql = statements();
    expect(sql[0]).toBe(
      'LOCK TABLE entries, entry_revisions, diaries, users, attachments, refresh_tokens, settings IN SHARE ROW EXCLUSIVE MODE',
    );
    expect(sql[1]).toBe("ALTER TABLE diaries ALTER COLUMN icon SET DEFAULT '📓'");
    expect(sql.indexOf(`UPDATE entries SET "index" = 1 WHERE "index" IS NULL`)).toBe(
      sql.indexOf('ALTER TABLE entries ALTER COLUMN "index" SET NOT NULL') - 1,
    );
    expect(sql).toContain(`UPDATE entries SET "created_at" = COALESCE(updated_at, date::timestamp) WHERE "created_at" IS NULL`);
    expect(sql.indexOf('UPDATE users SET "created_at" = COALESCE(updated_at, CURRENT_TIMESTAMP) WHERE "created_at" IS NULL'))
      .toBeLessThan(sql.indexOf('UPDATE users SET "updated_at" = created_at WHERE "updated_at" IS NULL'));
    expect(sql.filter((statement) => statement.endsWith('SET NOT NULL'))).toHaveLength(24);
    expect(sql.at(-1)).toBe('ALTER TABLE entries ALTER COLUMN search_vector SET NOT NULL');
    expect(sql.join('\n')).not.toContain('"email"');
  });

  it('lets the columns hold nulls again and drops the icon default, keeping the filled values', async () => {
    await new RequiredColumns1787184000000().down(queryRunner);

    const sql = statements();
    expect(sql.filter((statement) => statement.endsWith('DROP NOT NULL'))).toHaveLength(24);
    expect(sql.some((statement) => statement.startsWith('UPDATE'))).toBe(false);
    expect(sql.at(-1)).toBe('ALTER TABLE diaries ALTER COLUMN icon DROP DEFAULT');
  });
});
