import type { QueryRunner } from 'typeorm';
import { DiaryAiMode1790035200000 } from './migrations/1790035200000-diary-ai-mode';

describe('DiaryAiMode1790035200000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('gives every diary AI on, and keeps each entry’s copy of its diary’s mode in step', async () => {
    await new DiaryAiMode1790035200000().up(queryRunner);

    const statement = sql();
    expect(statement).toContain("ADD COLUMN ai_mode VARCHAR(10) NOT NULL DEFAULT 'on'");
    expect(statement).toContain("ADD CONSTRAINT chk_diaries_ai_mode CHECK (ai_mode IN ('on', 'off'))");
    expect(statement).toContain('ALTER TABLE entries ADD COLUMN diary_ai_off BOOLEAN NOT NULL DEFAULT false');
    expect(statement).toContain("SELECT d.ai_mode = 'off' FROM diaries d WHERE d.id = NEW.diary_id");
    expect(statement).toContain('BEFORE INSERT OR UPDATE OF diary_id, diary_ai_off ON entries');
    expect(statement).toContain('AFTER UPDATE OF ai_mode ON diaries');
    expect(statement).toContain("UPDATE entries SET diary_ai_off = (NEW.ai_mode = 'off') WHERE diary_id = NEW.id");
  });

  it('drops the triggers before the columns', async () => {
    await new DiaryAiMode1790035200000().down(queryRunner);

    const statement = sql();
    const order = [
      'DROP TRIGGER IF EXISTS trg_diaries_ai_mode_entries',
      'DROP TRIGGER IF EXISTS trg_entries_copy_diary_ai_mode',
      'DROP COLUMN IF EXISTS diary_ai_off',
      'DROP COLUMN IF EXISTS ai_mode',
    ].map((part) => statement.indexOf(part));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
