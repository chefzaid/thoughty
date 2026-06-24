import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

type PostgresConnectionRuntimeOptions = Pick<
  PostgresConnectionOptions,
  'host' | 'port' | 'username' | 'password' | 'database' | 'replication'
>;

interface PostgresConnectionEnv {
  [key: string]: string | number | undefined;
  POSTGRES_HOST?: string | number;
  POSTGRES_PORT?: string | number;
  POSTGRES_USER?: string | number;
  POSTGRES_PASSWORD?: string | number;
  POSTGRES_DB?: string | number;
  POSTGRES_READ_REPLICA_HOSTS?: string | number;
  POSTGRES_READ_REPLICA_PORTS?: string | number;
  POSTGRES_READ_REPLICA_USER?: string | number;
  POSTGRES_READ_REPLICA_PASSWORD?: string | number;
  POSTGRES_READ_REPLICA_DB?: string | number;
}

const DEFAULT_POSTGRES_PORT = 5432;

export function buildPostgresConnectionOptions(env: PostgresConnectionEnv): PostgresConnectionRuntimeOptions {
  const primary = {
    host: toStringValue(env.POSTGRES_HOST, 'localhost'),
    port: parsePositiveInteger(env.POSTGRES_PORT, DEFAULT_POSTGRES_PORT),
    username: toStringValue(env.POSTGRES_USER, 'postgres'),
    password: toStringValue(env.POSTGRES_PASSWORD, 'password'),
    database: toStringValue(env.POSTGRES_DB, 'journal'),
  };
  const replicaHosts = parseList(env.POSTGRES_READ_REPLICA_HOSTS);

  if (replicaHosts.length === 0) {
    return primary;
  }

  const replicaPorts = parsePorts(env.POSTGRES_READ_REPLICA_PORTS);
  const replicaCredentials = {
    username: toStringValue(env.POSTGRES_READ_REPLICA_USER, primary.username),
    password: toStringValue(env.POSTGRES_READ_REPLICA_PASSWORD, primary.password),
    database: toStringValue(env.POSTGRES_READ_REPLICA_DB, primary.database),
  };

  return {
    replication: {
      master: primary,
      slaves: replicaHosts.map((host, index) => ({
        host,
        port: replicaPorts[index] ?? replicaPorts[0] ?? primary.port,
        ...replicaCredentials,
      })),
    },
  };
}

function parseList(value: string | number | undefined): string[] {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePorts(value: string | number | undefined): number[] {
  return parseList(value)
    .map((port) => parsePositiveInteger(port, 0))
    .filter((port) => port > 0);
}

function parsePositiveInteger(value: string | number | undefined, fallback: number): number {
  const parsedValue = typeof value === 'number' ? value : Number.parseInt(value ?? '', 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

function toStringValue(value: string | number | undefined, fallback: string): string {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}
