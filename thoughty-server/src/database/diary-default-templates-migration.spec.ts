import type { QueryRunner } from 'typeorm';
import { DiaryDefaultTemplates1787961600000 } from './migrations/1787961600000-diary-default-templates';

describe('DiaryDefaultTemplates1787961600000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('adds an optional default template ID made of the characters template IDs use', async () => {
    await new DiaryDefaultTemplates1787961600000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('ALTER TABLE diaries');
    expect(sql).toContain('ADD COLUMN default_template_id VARCHAR(100)');
    expect(sql).toContain('ADD CONSTRAINT chk_diaries_default_template_id');
    expect(sql).toContain("default_template_id IS NULL OR default_template_id ~ '^[A-Za-z0-9_-]{1,100}$'");
  });

  it('drops the constraint and the column', async () => {
    await new DiaryDefaultTemplates1787961600000().down(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS chk_diaries_default_template_id');
    expect(sql).toContain('DROP COLUMN IF EXISTS default_template_id');
  });
});
