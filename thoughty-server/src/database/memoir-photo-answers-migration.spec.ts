import type { QueryRunner } from 'typeorm';
import { MemoirPhotoAnswers1789257600000 } from './migrations/1789257600000-memoir-photo-answers';

describe('MemoirPhotoAnswers1789257600000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('marks each photo story entry once, removed with its entry or its account, listed per writer by date', async () => {
    await new MemoirPhotoAnswers1789257600000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE memoir_photo_answers');
    expect(sql).toContain('entry_id INTEGER PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE');
    expect(sql).toContain('user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(sql).toContain('CREATE INDEX idx_memoir_photo_answers_user ON memoir_photo_answers(user_id, created_at)');
  });

  it('drops the table', async () => {
    await new MemoirPhotoAnswers1789257600000().down(queryRunner);

    expect((queryRunner.query as jest.Mock).mock.calls[0][0]).toContain('DROP TABLE IF EXISTS memoir_photo_answers');
  });
});
