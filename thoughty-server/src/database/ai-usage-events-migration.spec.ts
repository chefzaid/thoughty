import type { QueryRunner } from 'typeorm';
import { AiUsageEvents1785110400000 } from './migrations/1785110400000-ai-usage-events';

describe('AiUsageEvents1785110400000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('creates metadata-only AI usage accounting with bounded values', async () => {
    await new AiUsageEvents1785110400000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE ai_usage_events');
    expect(sql).toContain('REFERENCES users(id) ON DELETE CASCADE');
    expect(sql).toContain("CHECK (credential_source IN ('personal', 'server'))");
    expect(sql).toContain('prompt_tokens INTEGER NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0)');
    expect(sql).toContain('cost NUMERIC(14, 8) NOT NULL DEFAULT 0 CHECK (cost >= 0)');
    expect(sql).toContain('CREATE INDEX idx_ai_usage_events_user_created');
  });

  it('drops the AI usage table', async () => {
    await new AiUsageEvents1785110400000().down(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE IF EXISTS ai_usage_events');
  });
});
