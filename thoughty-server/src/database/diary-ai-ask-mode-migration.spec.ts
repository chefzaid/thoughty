import type { QueryRunner } from 'typeorm';
import { DiaryAiAskMode1790121600000 } from './migrations/1790121600000-diary-ai-ask-mode';

describe('DiaryAiAskMode1790121600000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('allows the ask mode and copies it to each entry with the same triggers', async () => {
    await new DiaryAiAskMode1790121600000().up(queryRunner);

    const statement = sql();
    expect(statement).toContain("ADD CONSTRAINT chk_diaries_ai_mode CHECK (ai_mode IN ('on', 'off', 'ask'))");
    expect(statement).toContain('ALTER TABLE entries ADD COLUMN diary_ai_ask BOOLEAN NOT NULL DEFAULT false');
    expect(statement).toContain("NEW.diary_ai_ask := COALESCE(mode = 'ask', false)");
    expect(statement).toContain('BEFORE INSERT OR UPDATE OF diary_id, diary_ai_off, diary_ai_ask ON entries');
    expect(statement).toContain("SET diary_ai_off = (NEW.ai_mode = 'off'), diary_ai_ask = (NEW.ai_mode = 'ask')");
  });

  it('turns a diary that asks to AI off, then restores the triggers before dropping the column', async () => {
    await new DiaryAiAskMode1790121600000().down(queryRunner);

    const statement = sql();
    const order = [
      "UPDATE diaries SET ai_mode = 'off' WHERE ai_mode = 'ask'",
      'BEFORE INSERT OR UPDATE OF diary_id, diary_ai_off ON entries',
      'DROP COLUMN IF EXISTS diary_ai_ask',
      "CHECK (ai_mode IN ('on', 'off'))",
    ].map((part) => statement.indexOf(part));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
