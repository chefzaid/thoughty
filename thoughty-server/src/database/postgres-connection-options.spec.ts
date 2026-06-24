import { buildPostgresConnectionOptions } from './postgres-connection-options';

describe('buildPostgresConnectionOptions', () => {
  it('uses the primary connection when no read replicas are configured', () => {
    expect(buildPostgresConnectionOptions({})).toEqual({
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'password',
      database: 'journal',
    });
  });

  it('parses the primary connection values', () => {
    expect(
      buildPostgresConnectionOptions({
        POSTGRES_HOST: 'primary.db',
        POSTGRES_PORT: '6543',
        POSTGRES_USER: 'app',
        POSTGRES_PASSWORD: 'secret',
        POSTGRES_DB: 'thoughty',
      }),
    ).toEqual({
      host: 'primary.db',
      port: 6543,
      username: 'app',
      password: 'secret',
      database: 'thoughty',
    });
  });

  it('builds TypeORM replication options for configured read replicas', () => {
    expect(
      buildPostgresConnectionOptions({
        POSTGRES_HOST: 'primary.db',
        POSTGRES_PORT: '5432',
        POSTGRES_USER: 'writer',
        POSTGRES_PASSWORD: 'writer-secret',
        POSTGRES_DB: 'thoughty',
        POSTGRES_READ_REPLICA_HOSTS: 'replica-a.db, replica-b.db',
        POSTGRES_READ_REPLICA_PORTS: '15432,25432',
        POSTGRES_READ_REPLICA_USER: 'reader',
        POSTGRES_READ_REPLICA_PASSWORD: 'reader-secret',
        POSTGRES_READ_REPLICA_DB: 'thoughty_ro',
      }),
    ).toEqual({
      replication: {
        master: {
          host: 'primary.db',
          port: 5432,
          username: 'writer',
          password: 'writer-secret',
          database: 'thoughty',
        },
        slaves: [
          {
            host: 'replica-a.db',
            port: 15432,
            username: 'reader',
            password: 'reader-secret',
            database: 'thoughty_ro',
          },
          {
            host: 'replica-b.db',
            port: 25432,
            username: 'reader',
            password: 'reader-secret',
            database: 'thoughty_ro',
          },
        ],
      },
    });
  });

  it('lets replicas inherit primary credentials and port when optional values are omitted', () => {
    expect(
      buildPostgresConnectionOptions({
        POSTGRES_HOST: 'primary.db',
        POSTGRES_USER: 'writer',
        POSTGRES_PASSWORD: 'writer-secret',
        POSTGRES_DB: 'thoughty',
        POSTGRES_READ_REPLICA_HOSTS: 'replica.db',
      }),
    ).toEqual({
      replication: {
        master: {
          host: 'primary.db',
          port: 5432,
          username: 'writer',
          password: 'writer-secret',
          database: 'thoughty',
        },
        slaves: [
          {
            host: 'replica.db',
            port: 5432,
            username: 'writer',
            password: 'writer-secret',
            database: 'thoughty',
          },
        ],
      },
    });
  });

  it('falls back for invalid primary and replica ports', () => {
    expect(
      buildPostgresConnectionOptions({
        POSTGRES_PORT: 'not-a-port',
        POSTGRES_READ_REPLICA_HOSTS: 'replica-a.db,replica-b.db',
        POSTGRES_READ_REPLICA_PORTS: '0,not-a-port',
      }),
    ).toEqual({
      replication: {
        master: {
          host: 'localhost',
          port: 5432,
          username: 'postgres',
          password: 'password',
          database: 'journal',
        },
        slaves: [
          {
            host: 'replica-a.db',
            port: 5432,
            username: 'postgres',
            password: 'password',
            database: 'journal',
          },
          {
            host: 'replica-b.db',
            port: 5432,
            username: 'postgres',
            password: 'password',
            database: 'journal',
          },
        ],
      },
    });
  });
});
