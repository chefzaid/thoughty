import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Attachment, BookVersion, Entry, ShareLink, User } from '@/database/entities';
import { SHARE_LINK_LIMIT } from './dto';
import { ShareLinksService } from './share-links.service';
import { SharedContentService } from './shared-content.service';

const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
const unavailable = 'SHARE_LINK_NOT_FOUND';

describePostgres('PostgreSQL private share links', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let links: ShareLinksService;
  let shared: SharedContentService;
  let writerId: number;
  let otherId: number;
  let entryId: number;
  let otherEntryId: number;
  let bookVersionId: number;

  const one = async (sql: string, params: unknown[]) => (await dataSource.query(sql, params))[0]?.id as number;
  const linkCount = async () => (await dataSource.query('SELECT COUNT(*)::int AS count FROM share_links'))[0].count as number;
  const shareEntry = (options: { maxViews?: number; showMood?: boolean } = {}) =>
    links.create(writerId, { kind: 'entry', targetId: entryId, expiresAt: inDays(7), ...options });

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    links = new ShareLinksService(dataSource.getRepository(ShareLink));
    shared = new SharedContentService(
      dataSource.getRepository(ShareLink),
      dataSource.getRepository(Entry),
      dataSource.getRepository(Attachment),
      dataSource.getRepository(BookVersion),
    );
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
    entryId = await one(
      `INSERT INTO entries (user_id, date, title, content, format, mood, feelings, tags)
       VALUES ($1, '2026-10-27', 'Sea', 'We walked ![shell](attachment:1)', 'markdown', 4, '{calm}', '{family}') RETURNING id`,
      [writerId],
    );
    otherEntryId = await one(`INSERT INTO entries (user_id, date, content) VALUES ($1, '2026-10-26', 'Another day') RETURNING id`, [writerId]);
    await dataSource.query(
      `INSERT INTO attachments (user_id, entry_id, original_filename, stored_filename, mimetype, size)
       VALUES ($1, $2, 'shell.jpg', 'k-shell.jpg', 'image/jpeg', 4), ($1, $3, 'other.jpg', 'k-other.jpg', 'image/jpeg', 4)`,
      [writerId, entryId, otherEntryId],
    );
    bookVersionId = await one(
      `INSERT INTO book_versions (user_id, scope_key, version_number, title, format, filename, content_type, content, manifest, chapter_count, entry_count, added_entry_count)
       VALUES ($1, 'all', 1, 'Summer', 'html', 'summer.html', 'text/html', '<p>book</p>'::bytea, '{}', 1, 1, 1) RETURNING id`,
      [writerId],
    );
  });

  it('opens a shared entry by its token alone, keeping only the token’s hash, and counts each view', async () => {
    const link = await shareEntry({ showMood: true });

    const [stored] = await dataSource.query('SELECT token_hash FROM share_links');
    expect(stored.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.token_hash).not.toContain(link.token);

    const { entry } = await shared.open(link.token);
    expect(entry).toEqual(expect.objectContaining({ title: 'Sea', mood: 4, feelings: ['calm'], tags: [], attachments: [expect.objectContaining({ id: 1, name: 'shell.jpg' })] }));
    await shared.open(link.token);
    const { links: listed } = await links.list(writerId, 'entry', entryId);
    expect(listed).toEqual([expect.objectContaining({ id: link.id, viewCount: 2, lastViewedAt: expect.any(Date) })]);
  });

  it('serves the shared entry’s own files only', async () => {
    const link = await shareEntry();

    await expect(shared.attachmentFile(link.token, 1, 'file')).resolves.toEqual(expect.objectContaining({ key: 'k-shell.jpg' }));
    await expectApiError(shared.attachmentFile(link.token, 2, 'file'), NotFoundException, unavailable);
  });

  it('stops a limited link once its views are used, keeping the last view’s files for a moment', async () => {
    const link = await shareEntry({ maxViews: 2 });

    await Promise.all([shared.open(link.token), shared.open(link.token)]);
    await expectApiError(shared.open(link.token), NotFoundException, unavailable);
    await expect(shared.attachmentFile(link.token, 1, 'file')).resolves.toBeDefined();

    await dataSource.query("UPDATE share_links SET last_viewed_at = now() - interval '2 hours'");
    await expectApiError(shared.attachmentFile(link.token, 1, 'file'), NotFoundException, unavailable);
    const [{ view_count }] = await dataSource.query('SELECT view_count FROM share_links');
    expect(view_count).toBe(2);
  });

  it('reads an expired, revoked or never-made link exactly alike', async () => {
    const expired = await shareEntry();
    const revoked = await shareEntry();
    await dataSource.query("UPDATE share_links SET expires_at = now() - interval '1 second', created_at = now() - interval '1 day' WHERE id = $1", [expired.id]);
    await links.revoke(writerId, revoked.id);

    for (const token of [expired.token, revoked.token, 'A'.repeat(43)]) {
      await expectApiError(shared.open(token), NotFoundException, unavailable);
      await expectApiError(shared.attachmentFile(token, 1, 'file'), NotFoundException, unavailable);
    }
    await expectApiError(links.revoke(otherId, expired.id), NotFoundException, unavailable);
    // Listing drops the expired link for good
    await expect(links.list(writerId, 'entry', entryId)).resolves.toEqual(expect.objectContaining({ links: [], activeCount: 0 }));
    expect(await linkCount()).toBe(0);
  });

  it('drops an entry’s links as it goes to the recycle bin or is sealed, and with the entry, book or account', async () => {
    const binned = await shareEntry();
    await dataSource.query('UPDATE entries SET deleted_at = now() WHERE id = $1', [entryId]);
    expect(await linkCount()).toBe(0);
    await dataSource.query('UPDATE entries SET deleted_at = NULL WHERE id = $1', [entryId]);
    await expectApiError(shared.open(binned.token), NotFoundException, unavailable);

    await shareEntry();
    await dataSource.query("UPDATE entries SET sealed_until = now() + interval '1 year' WHERE id = $1", [entryId]);
    expect(await linkCount()).toBe(0);
    await dataSource.query('UPDATE entries SET sealed_until = NULL WHERE id = $1', [entryId]);

    await shareEntry();
    await links.create(writerId, { kind: 'bookVersion', targetId: bookVersionId, expiresAt: inDays(1) });
    await dataSource.query('DELETE FROM entries WHERE id = $1', [entryId]);
    await dataSource.query('DELETE FROM book_versions WHERE id = $1', [bookVersionId]);
    expect(await linkCount()).toBe(0);

    const kept = await links.create(writerId, { kind: 'entry', targetId: otherEntryId, expiresAt: inDays(1) });
    await dataSource.query('UPDATE users SET deleted_at = now() WHERE id = $1', [writerId]);
    await expectApiError(shared.open(kept.token), NotFoundException, unavailable);
    await dataSource.query('DELETE FROM users WHERE id = $1', [writerId]);
    expect(await linkCount()).toBe(0);
  });

  it('refuses sharing an entry in the recycle bin or someone else’s', async () => {
    await dataSource.query('UPDATE entries SET deleted_at = now() WHERE id = $1', [otherEntryId]);

    await expectApiError(links.create(writerId, { kind: 'entry', targetId: otherEntryId, expiresAt: inDays(1) }), NotFoundException, 'ENTRY_NOT_FOUND');
    await expectApiError(links.create(otherId, { kind: 'entry', targetId: entryId, expiresAt: inDays(1) }), NotFoundException, 'ENTRY_NOT_FOUND');
    await expectApiError(links.list(otherId, 'bookVersion', bookVersionId), NotFoundException, 'BOOK_VERSION_NOT_FOUND');
  });

  it('shares a book as its stored file, counting downloads', async () => {
    const link = await links.create(writerId, { kind: 'bookVersion', targetId: bookVersionId, expiresAt: inDays(30), maxViews: 1 });

    await expect(shared.open(link.token)).resolves.toEqual(expect.objectContaining({
      kind: 'bookVersion', entry: null, bookVersion: { title: 'Summer', author: null, format: 'html', filename: 'summer.html', size: 11 },
    }));
    await expect(shared.downloadBook(link.token)).resolves.toEqual({ content: Buffer.from('<p>book</p>'), filename: 'summer.html', contentType: 'text/html' });
    await expectApiError(shared.downloadBook(link.token), NotFoundException, unavailable);
    await expectApiError(shared.open(link.token), NotFoundException, unavailable);
    await expectApiError(shared.attachmentFile(link.token, 1, 'file'), NotFoundException, unavailable);
  });

  it('holds the limit of unexpired links under concurrent requests', async () => {
    const values = Array.from({ length: SHARE_LINK_LIMIT - 2 }, (_, index) => `($1, $2, lpad('${index}', 64, '0'), now() + interval '1 day')`).join(', ');
    await dataSource.query(`INSERT INTO share_links (user_id, entry_id, token_hash, expires_at) VALUES ${values}`, [writerId, otherEntryId]);
    // An expired link does not count
    await dataSource.query(
      "INSERT INTO share_links (user_id, entry_id, token_hash, expires_at, created_at) VALUES ($1, $2, repeat('f', 64), now() - interval '1 minute', now() - interval '1 day')",
      [writerId, otherEntryId],
    );

    const results = await Promise.allSettled(Array.from({ length: 4 }, () => shareEntry()));

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    const refused = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(refused?.reason).toBeInstanceOf(BadRequestException);
    expect(await linkCount()).toBe(SHARE_LINK_LIMIT);
  });
});
