import type { QueryRunner } from 'typeorm';
import { FeatureRequests1784851200000 } from './migrations/1784851200000-feature-requests';

describe('FeatureRequests1784851200000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('creates persisted requests and unique user votes', async () => {
    await new FeatureRequests1784851200000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE feature_requests');
    expect(sql).toContain('CREATE TABLE feature_request_votes');
    expect(sql).toContain('UNIQUE(feature_request_id, user_id)');
    expect(sql).toContain('REFERENCES users(id) ON DELETE CASCADE');
  });

  it('drops votes before requests', async () => {
    await new FeatureRequests1784851200000().down(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql.indexOf('feature_request_votes')).toBeLessThan(sql.indexOf('feature_requests'));
  });
});
