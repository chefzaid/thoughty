import type { QueryRunner } from 'typeorm';
import { AudioTranscriptions1785196800000 } from './migrations/1785196800000-audio-transcriptions';

describe('AudioTranscriptions1785196800000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('adds cached transcript metadata to attachments', async () => {
    await new AudioTranscriptions1785196800000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('ALTER TABLE attachments');
    expect(sql).toContain('ADD COLUMN transcript TEXT');
    expect(sql).toContain('ADD COLUMN transcribed_at TIMESTAMP');
  });

  it('removes cached transcript metadata', async () => {
    await new AudioTranscriptions1785196800000().down(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('DROP COLUMN IF EXISTS transcribed_at');
    expect(sql).toContain('DROP COLUMN IF EXISTS transcript');
  });
});
