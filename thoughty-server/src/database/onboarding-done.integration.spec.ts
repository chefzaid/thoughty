import { ConfigService } from '@/modules/config/config.service';
import { Setting } from './entities';
import { OnboardingDone1789084800000 } from './migrations/1789084800000-onboarding-done';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from './postgres-test-database.test-helpers';

describePostgres('OnboardingDone1789084800000 on PostgreSQL', () => {
  let database: PostgresTestDatabase;
  let config: ConfigService;

  const addUser = async (username: string): Promise<number> => {
    const [{ id }] = await database.dataSource.query(
      `INSERT INTO users (username, email, auth_provider) VALUES ($1, $2, 'local') RETURNING id`,
      [username, `${username}@example.com`],
    );
    return id;
  };

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    config = new ConfigService(database.dataSource.getRepository(Setting));
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('marks the existing accounts done, keeps a stored value, and leaves later accounts to the welcome page', async () => {
    const queryRunner = database.dataSource.createQueryRunner();
    const migration = new OnboardingDone1789084800000();
    await migration.down(queryRunner);
    const existing = await addUser('existing');
    const stored = await addUser('stored');
    await database.dataSource.query(`INSERT INTO settings (user_id, key, value) VALUES ($1, 'onboardingDone', 'false')`, [stored]);

    await migration.up(queryRunner);
    await queryRunner.release();
    const created = await addUser('created');

    expect((await config.getConfig(existing)).onboardingDone).toBe('true');
    expect((await config.getConfig(stored)).onboardingDone).toBe('false');
    expect((await config.getConfig(created)).onboardingDone).toBe('false');
  });
});
