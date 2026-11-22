import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, User } from '@/database/entities';
import { buildTimeCapsuleBed } from '@/modules/time-capsules/time-capsules.integration.test-helpers';

/** Groups on people: saved once each in the writer's spelling, joined when merging, and checked by the database. */
describePostgres('PostgreSQL person groups', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let bed: ReturnType<typeof buildTimeCapsuleBed>;
  let writerId: number;
  let otherId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    bed = buildTimeCapsuleBed(dataSource);
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
    for (const userId of [writerId, otherId]) {
      await dataSource.getRepository(Diary).save({ userId, name: 'Home', isDefault: true, position: 0 });
    }
  });

  const write = async (text: string, userId = writerId) =>
    bed.journal.create(userId, { date: '2026-10-01', text, tags: [] });
  const personNamed = async (name: string, userId = writerId) =>
    (await bed.people.list(userId)).people.find((person) => person.name === name)!;
  const group = async (name: string, groups: string[], userId = writerId) =>
    bed.people.update(userId, (await personNamed(name, userId)).id, { name, groups });

  it('starts people in no group and saves each group once, spelled as on the writer’s other people only', async () => {
    await write('Coffee with @Marie, @Paul and @Ines.');
    await write('Lunch with @Paul.', otherId);
    expect((await personNamed('Marie')).groups).toEqual([]);

    await group('Paul', ['FAMILY'], otherId);
    expect((await group('Marie', ['Friends', 'Climbing', 'friends'])).groups).toEqual(['Friends', 'Climbing']);
    // Someone else's spelling is never used
    expect((await group('Paul', ['friends', 'family'])).groups).toEqual(['Friends', 'family']);
    // A writer can still respell the group of the only person in it
    expect((await group('Marie', ['Friends', 'CLIMBING'])).groups).toEqual(['Friends', 'CLIMBING']);
    expect((await group('Paul', [])).groups).toEqual([]);
    expect((await bed.people.update(writerId, (await personNamed('Ines')).id, { name: 'Ines' })).groups).toEqual([]);
  });

  it('adds the duplicate’s groups the person kept is not in when merging, in order', async () => {
    await write('Dinner with @Marie, @MarieC and @Zoe.');
    await group('Marie', ['Friends', 'Climbing']);
    await group('MarieC', ['climbing', 'Family', 'Work']);

    const merged = await bed.people.merge(writerId, (await personNamed('Marie')).id, { duplicateId: (await personNamed('MarieC')).id });
    expect(merged.groups).toEqual(['Friends', 'Climbing', 'Family', 'Work']);
    expect((await bed.people.merge(writerId, (await personNamed('Zoe')).id, { duplicateId: merged.id })).groups)
      .toEqual(['Friends', 'Climbing', 'Family', 'Work']);
  });

  it('refuses a missing or empty group name in the database', async () => {
    await write('Coffee with @Marie.');
    const { id } = await personNamed('Marie');

    await expect(dataSource.query("UPDATE people SET groups = '{\"\"}' WHERE id = $1", [id])).rejects.toThrow(/chk_people_groups_named/);
    await expect(dataSource.query("UPDATE people SET groups = ARRAY['Friends', NULL] WHERE id = $1", [id])).rejects.toThrow(/chk_people_groups_named/);
    await expect(dataSource.query('UPDATE people SET groups = NULL WHERE id = $1', [id])).rejects.toThrow(/null value/);
  });
});
