import { buildPostgresPoolOptions } from './postgres-pool-options';

describe('buildPostgresPoolOptions', () => {
  it('uses conservative defaults when no environment values are configured', () => {
    expect(buildPostgresPoolOptions({})).toEqual({
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  });

  it('parses positive integer environment values', () => {
    expect(
      buildPostgresPoolOptions({
        POSTGRES_POOL_MAX: '20',
        POSTGRES_POOL_IDLE_TIMEOUT_MS: '45000',
        POSTGRES_POOL_CONNECTION_TIMEOUT_MS: '8000',
      }),
    ).toEqual({
      max: 20,
      idleTimeoutMillis: 45000,
      connectionTimeoutMillis: 8000,
    });
  });

  it('falls back for invalid, empty, or non-positive values', () => {
    expect(
      buildPostgresPoolOptions({
        POSTGRES_POOL_MAX: '0',
        POSTGRES_POOL_IDLE_TIMEOUT_MS: 'not-a-number',
        POSTGRES_POOL_CONNECTION_TIMEOUT_MS: '-1',
      }),
    ).toEqual({
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  });
});
