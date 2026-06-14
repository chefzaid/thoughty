export interface PostgresPoolOptions {
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

interface PostgresPoolEnv {
  [key: string]: string | number | undefined;
  POSTGRES_POOL_MAX?: string | number;
  POSTGRES_POOL_IDLE_TIMEOUT_MS?: string | number;
  POSTGRES_POOL_CONNECTION_TIMEOUT_MS?: string | number;
}

const DEFAULT_POOL_OPTIONS: PostgresPoolOptions = {
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

function parsePositiveInteger(value: string | number | undefined, fallback: number): number {
  const parsedValue = typeof value === 'number' ? value : Number.parseInt(value ?? '', 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

export function buildPostgresPoolOptions(env: PostgresPoolEnv): PostgresPoolOptions {
  return {
    max: parsePositiveInteger(env.POSTGRES_POOL_MAX, DEFAULT_POOL_OPTIONS.max),
    idleTimeoutMillis: parsePositiveInteger(
      env.POSTGRES_POOL_IDLE_TIMEOUT_MS,
      DEFAULT_POOL_OPTIONS.idleTimeoutMillis,
    ),
    connectionTimeoutMillis: parsePositiveInteger(
      env.POSTGRES_POOL_CONNECTION_TIMEOUT_MS,
      DEFAULT_POOL_OPTIONS.connectionTimeoutMillis,
    ),
  };
}
