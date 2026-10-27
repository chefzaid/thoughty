import type { QueryRunner } from 'typeorm';
import { VideoPosters1787356800000 } from './migrations/1787356800000-video-posters';

describe('VideoPosters1787356800000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('adds the poster frame key and size to attachments, set together', async () => {
    await new VideoPosters1787356800000().up(queryRunner);

    expect(sql()).toContain('ALTER TABLE attachments');
    expect(sql()).toContain('ADD COLUMN poster_filename VARCHAR(255)');
    expect(sql()).toContain('ADD COLUMN poster_size INTEGER');
    expect(sql()).toContain('CHECK ((poster_filename IS NULL) = (poster_size IS NULL))');
  });

  it('drops the check, then the columns', async () => {
    await new VideoPosters1787356800000().down(queryRunner);

    const statement = sql();
    const order = [
      'DROP CONSTRAINT IF EXISTS chk_attachments_poster_pair',
      'DROP COLUMN IF EXISTS poster_size',
      'DROP COLUMN IF EXISTS poster_filename',
    ].map((part) => statement.indexOf(part));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
  });
});
