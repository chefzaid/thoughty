import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { DataSource, type DataSourceOptions } from 'typeorm';

/**
 * PostgreSQL integration specs run only when THOUGHTY_PG_TEST_URL points at the disposable
 * `thoughty_ha_test` database on localhost; without it they are skipped. Each suite works in a
 * database of its own, created from that connection and dropped afterwards, so suites can run
 * in parallel Jest workers and roll migrations back without touching each other.
 */
export const postgresTestUrl = process.env.THOUGHTY_PG_TEST_URL;

if (postgresTestUrl) {
  const { hostname, pathname } = new URL(postgresTestUrl);
  if (!['127.0.0.1', 'localhost'].includes(hostname) || pathname !== '/thoughty_ha_test') {
    throw new Error('Use the isolated thoughty_ha_test localhost fixture');
  }
}

export const describePostgres = postgresTestUrl ? describe : describe.skip;

/** Creating a database and running every migration can take a while on a busy machine. */
export const POSTGRES_SETUP_TIMEOUT_MS = 60_000;

export interface PostgresTestDatabase {
  dataSource: DataSource;
  /** Connection URL of the suite's database, for opening a second connection to it. */
  url: string;
  /** Closes the connection and drops the suite's database. */
  drop: () => Promise<void>;
}

/** Runs a statement on the base fixture database, outside the suite's own database. */
async function administer(sql: string): Promise<void> {
  const admin = await new DataSource({ type: 'postgres', url: postgresTestUrl }).initialize();
  try {
    await admin.query(sql);
  } finally {
    await admin.destroy();
  }
}

/**
 * Creates an empty database for one suite and connects to it. By default every migration is
 * applied; pass `synchronize: true` with a list of entities to build just those tables instead.
 */
export async function createPostgresTestDatabase(
  options: Partial<Pick<DataSourceOptions, 'entities' | 'synchronize'>> = {},
): Promise<PostgresTestDatabase> {
  if (!postgresTestUrl) throw new Error('THOUGHTY_PG_TEST_URL is not set');
  const name = `thoughty_ha_test_${process.pid}_${randomBytes(4).toString('hex')}`;
  await administer(`CREATE DATABASE "${name}"`);

  const url = new URL(postgresTestUrl);
  url.pathname = `/${name}`;
  const dataSource = new DataSource({
    type: 'postgres',
    url: url.toString(),
    entities: [join(__dirname, 'entities', '*.entity.ts')],
    migrations: options.synchronize ? [] : [join(__dirname, 'migrations', '*.ts')],
    ...options,
  });
  try {
    await dataSource.initialize();
    if (!options.synchronize) await dataSource.runMigrations({ transaction: 'all' });
  } catch (error) {
    if (dataSource.isInitialized) await dataSource.destroy();
    await administer(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    throw error;
  }

  return {
    dataSource,
    url: url.toString(),
    drop: async () => {
      if (dataSource.isInitialized) await dataSource.destroy();
      await administer(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    },
  };
}
