import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, TimeCapsule, User } from '@/database/entities';
import { buildTimeCapsuleBed } from './time-capsules.integration.test-helpers';

/** Next year, so the opening dates stay ahead of today whenever the spec runs; its January has no daylight-saving change. */
const year = new Date().getUTCFullYear() + 1;
const on = (day: string) => `${year}-${day}`;
const at = (instant: string) => new Date(`${year}-${instant}`);

describePostgres('PostgreSQL time capsules: sealing and opening', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let bed: ReturnType<typeof buildTimeCapsuleBed>;
  let writerId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    bed = buildTimeCapsuleBed(dataSource);
    writerId = (await dataSource.getRepository(User).save({ username: 'writer', email: 'writer@example.com', emailVerified: true })).id;
    await dataSource.getRepository(Diary).save({ userId: writerId, name: 'Journal', isDefault: true, position: 0 });
  });

  const seal = (opensOn: string, timeZone: string, text = 'Dear future me, hello @Rosalind.', openHour?: number) =>
    bed.journal.create(writerId, {
      text,
      title: 'A letter',
      tags: ['future-self'],
      date: `${year - 1}-10-27`,
      seal: { opensOn, timeZone, openHour },
    });
  const capsuleOf = (entryId: number) => dataSource.getRepository(TimeCapsule).findOneByOrFail({ entryId });

  it('opens each capsule at the chosen hour on its writer’s clock, whatever their zone, and emails it once', async () => {
    const { entryId: paris } = await seal(on('01-15'), 'Europe/Paris');
    const { entryId: tokyo } = await seal(on('01-15'), 'Asia/Tokyo', 'From Tokyo', 7);
    const { entryId: newYork } = await seal(on('01-15'), 'America/New_York', 'From New York', 23);

    // 22:00 UTC on the 14th is 07:00 on the 15th in Tokyo; Paris (08:00 UTC) and New York (04:00 UTC on the 16th) wait
    expect(await bed.delivery.deliverDue(at('01-14T21:59:00Z'))).toBe(0);
    expect(await bed.delivery.deliverDue(at('01-14T22:00:00Z'))).toBe(1);
    expect((await capsuleOf(tokyo)).openedAt).toEqual(at('01-14T22:00:00Z'));
    expect((await capsuleOf(paris)).openedAt).toBeNull();

    expect(await bed.delivery.deliverDue(at('01-15T08:00:00Z'))).toBe(1);
    expect(await bed.delivery.deliverDue(at('01-15T09:00:00Z'))).toBe(0);
    expect(await bed.delivery.deliverDue(at('01-16T04:00:00Z'))).toBe(1);
    expect((await capsuleOf(newYork)).openedAt).toEqual(at('01-16T04:00:00Z'));

    expect(bed.emailService.sendRenderedEmail).toHaveBeenCalledTimes(3);
    const [address, email] = bed.emailService.sendRenderedEmail.mock.calls[1];
    expect(address).toBe('writer@example.com');
    expect(email.text).toContain('Dear future me, hello @Rosalind.');
    expect(email.text).toContain(`/journal?entry=${paris}`);
  });

  it('gives the opened entry its text back everywhere: search, people, history, Highlights for a week', async () => {
    const { entryId } = await seal(on('01-15'), 'Europe/Paris');
    await bed.delivery.deliverDue(at('01-15T08:00:00Z'));

    const capsule = await capsuleOf(entryId);
    expect(capsule).toMatchObject({ sealedContent: null, sealedTitle: null, sealedTags: [], openedAt: expect.any(Date) });
    const found = await bed.journal.getEntries(writerId, { search: 'Rosalind', page: 1, limit: 10 });
    expect(found.entries).toEqual([expect.objectContaining({ id: entryId, title: 'A letter', tags: ['future-self'], sealed_until: null })]);
    expect((await bed.people.list(writerId)).people).toEqual([expect.objectContaining({ name: 'Rosalind', entryCount: 1 })]);
    await expect(bed.journal.update(writerId, entryId, { text: 'Edited after opening', tags: [], date: `${year - 1}-10-27` })).resolves.toMatchObject({ success: true });

    // Highlights shows it for seven days after it opened
    const opened = await bed.timeCapsules.findRecentlyOpened(writerId, undefined, at('01-21T08:00:00Z'));
    expect(opened.map((item) => item.entryId)).toEqual([entryId]);
    expect(await bed.timeCapsules.findRecentlyOpened(writerId, undefined, at('01-22T08:00:01Z'))).toEqual([]);
  });

  it('keeps a capsule in the recycle bin sealed, and opens it once it is restored', async () => {
    const { entryId } = await seal(on('01-15'), 'UTC');
    await bed.journal.delete(writerId, entryId);

    expect(await bed.delivery.deliverDue(at('02-01T00:00:00Z'))).toBe(0);
    expect((await capsuleOf(entryId)).openedAt).toBeNull();

    await bed.bin.restore(writerId, [entryId]);
    expect(await bed.delivery.deliverDue(at('02-01T00:01:00Z'))).toBe(1);
    expect((await bed.entries.findOneByOrFail({ id: entryId })).content).toBe('Dear future me, hello @Rosalind.');
  });

  it('opens without email for an unverified address or a deleted account, and purging the entry removes the capsule', async () => {
    const { entryId } = await seal(on('01-15'), 'UTC');
    await dataSource.query('UPDATE users SET email_verified = FALSE WHERE id = $1', [writerId]);
    expect(await bed.delivery.deliverDue(at('01-15T09:00:00Z'))).toBe(0);
    expect((await capsuleOf(entryId)).openedAt).not.toBeNull();

    const { entryId: second } = await seal(on('01-16'), 'UTC');
    await dataSource.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [writerId]);
    expect(await bed.delivery.deliverDue(at('01-16T09:00:00Z'))).toBe(0);
    expect((await capsuleOf(second)).openedAt).toBeNull();

    await dataSource.query('DELETE FROM entries WHERE id = $1', [second]);
    expect(await dataSource.getRepository(TimeCapsule).countBy({ entryId: second })).toBe(0);
    expect(bed.emailService.sendRenderedEmail).not.toHaveBeenCalled();
  });

  it('opens early at the writer’s request without email, once', async () => {
    const { entryId } = await seal(`${year + 10}-05-01`, 'Europe/Paris');

    const { entry } = await bed.journal.unseal(writerId, entryId);

    expect(entry).toMatchObject({ id: entryId, content: 'Dear future me, hello @Rosalind.', title: 'A letter', sealed_until: null });
    await expect(bed.journal.unseal(writerId, entryId)).rejects.toMatchObject({ response: { code: 'ENTRY_NOT_SEALED' } });
    expect(await bed.delivery.deliverDue(new Date(`${year + 10}-05-01T08:00:00Z`))).toBe(0);
    expect(bed.emailService.sendRenderedEmail).not.toHaveBeenCalled();
    const [highlighted] = await bed.timeCapsules.findRecentlyOpened(writerId, undefined);
    expect(highlighted.openedAt!.getTime()).toBeLessThan(highlighted.openAt.getTime());
  });

  it('never opens a capsule twice when two workers run at once', async () => {
    await seal(on('01-15'), 'UTC');
    await seal(on('01-15'), 'UTC');
    const other = buildTimeCapsuleBed(dataSource);

    const [first, second] = await Promise.all([
      bed.delivery.deliverDue(at('01-15T09:00:00Z')),
      other.delivery.deliverDue(at('01-15T09:00:00Z')),
    ]);

    expect(first + second).toBe(2);
  });
});
