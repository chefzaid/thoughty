import type { QueryRunner } from 'typeorm';
import { EntryDiaryForeignKey1787097600000 } from './migrations/1787097600000-entry-diary-foreign-key';

describe('EntryDiaryForeignKey1787097600000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sqlOf = () => ((queryRunner.query as jest.Mock).mock.calls[0][0] as string).replace(/\s+/g, ' ');

  beforeEach(() => jest.clearAllMocks());

  it('replaces any foreign key on the column, moves stray entries to the default diary, then adds the key', async () => {
    await new EntryDiaryForeignKey1787097600000().up(queryRunner);

    const sql = sqlOf();
    const order = [
      "EXECUTE format('ALTER TABLE entries DROP CONSTRAINT %I', existing.conname)",
      'SET diary_id = (SELECT d.id FROM diaries d WHERE d.user_id = e.user_id AND d.is_default ORDER BY d.id LIMIT 1)',
      'NOT EXISTS (SELECT 1 FROM diaries d WHERE d.id = e.diary_id AND d.user_id = e.user_id)',
      'ADD CONSTRAINT fk_entries_diary FOREIGN KEY (diary_id) REFERENCES diaries(id) ON DELETE SET NULL',
    ].map((statement) => sql.indexOf(statement));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
  });

  it('drops the key and leaves the entries where they are', async () => {
    await new EntryDiaryForeignKey1787097600000().down(queryRunner);

    expect(sqlOf()).toBe('ALTER TABLE entries DROP CONSTRAINT IF EXISTS fk_entries_diary');
  });
});
