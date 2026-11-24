import type { QueryRunner } from 'typeorm';
import { DiaryAiLocalMode1790640000000 } from './migrations/1790640000000-diary-ai-local-mode';

describe('DiaryAiLocalMode1790640000000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('allows the local mode, which is AI off for the server, and copies it to each entry with the same triggers', async () => {
    await new DiaryAiLocalMode1790640000000().up(queryRunner);

    const statement = sql();
    expect(statement).toContain("ADD CONSTRAINT chk_diaries_ai_mode CHECK (ai_mode IN ('on', 'off', 'ask', 'local'))");
    expect(statement).toContain('ALTER TABLE entries ADD COLUMN diary_ai_local BOOLEAN NOT NULL DEFAULT false');
    expect(statement).toContain("NEW.diary_ai_off := COALESCE(mode IN ('off', 'local'), false)");
    expect(statement).toContain("NEW.diary_ai_local := COALESCE(mode = 'local', false)");
    expect(statement).toContain('BEFORE INSERT OR UPDATE OF diary_id, diary_ai_off, diary_ai_ask, diary_ai_local ON entries');
    expect(statement).toContain("SET diary_ai_off = (NEW.ai_mode IN ('off', 'local'))");
    expect(statement).toContain("diary_ai_local = (NEW.ai_mode = 'local')");
  });

  it('turns a local diary to AI off, then restores the triggers before dropping the column', async () => {
    await new DiaryAiLocalMode1790640000000().down(queryRunner);

    const statement = sql();
    const order = [
      "UPDATE diaries SET ai_mode = 'off' WHERE ai_mode = 'local'",
      'BEFORE INSERT OR UPDATE OF diary_id, diary_ai_off, diary_ai_ask ON entries',
      'DROP COLUMN IF EXISTS diary_ai_local',
      "CHECK (ai_mode IN ('on', 'off', 'ask'))",
    ].map((part) => statement.indexOf(part));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
