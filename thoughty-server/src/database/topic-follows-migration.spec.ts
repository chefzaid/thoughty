import type { QueryRunner } from 'typeorm';
import { TopicFollows1788480000000 } from './migrations/1788480000000-topic-follows';

describe('TopicFollows1788480000000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('keeps one lower-case topic per reader and tag, gone with the reader', async () => {
    await new TopicFollows1788480000000().up(queryRunner);

    const statement = sql();
    expect(statement).toContain('CREATE TABLE topic_follows');
    expect(statement).toContain('user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(statement).toContain('tag VARCHAR(50) NOT NULL');
    expect(statement).toContain('PRIMARY KEY (user_id, tag)');
    expect(statement).toContain("CHECK (tag = lower(tag) AND btrim(tag) <> '')");
  });

  it('drops the table', async () => {
    await new TopicFollows1788480000000().down(queryRunner);

    expect(sql()).toBe('DROP TABLE IF EXISTS topic_follows;');
  });
});
