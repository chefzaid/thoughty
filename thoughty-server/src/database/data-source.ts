import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'node:path';
import { buildPostgresConnectionOptions } from './postgres-connection-options';
import { buildPostgresPoolOptions } from './postgres-pool-options';

config({ path: join(__dirname, '..', '..', '.env') });

export default new DataSource({
  type: 'postgres',
  ...buildPostgresConnectionOptions(process.env),
  entities: [join(__dirname, 'entities', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  extra: buildPostgresPoolOptions(process.env),
  synchronize: false,
});
