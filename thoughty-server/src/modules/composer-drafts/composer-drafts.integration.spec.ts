import { ConflictException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { ComposerDraft, User } from '@/database/entities';
import { ComposerDraftsService } from './composer-drafts.service';

const fields = { text: 'We walked', title: 'Walk', tags: ['walks', 'river'], format: 'markdown' as const, mood: 4, feelings: ['calm'] };

describePostgres('PostgreSQL composer drafts', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let service: ComposerDraftsService;
  let writerId: number;
  let otherId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    service = new ComposerDraftsService(dataSource.getRepository(ComposerDraft));
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
  });

  it('saves a draft revision by revision, each writer their own', async () => {
    const first = await service.save(writerId, { ...fields, baseRevision: null });
    expect(first).toEqual({ ...fields, revision: 1, updatedAt: expect.any(Date) });

    const second = await service.save(writerId, { ...fields, text: 'We walked on', baseRevision: 1 });
    expect(second).toMatchObject({ text: 'We walked on', revision: 2 });
    expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());

    await expect(service.get(writerId)).resolves.toEqual({ draft: { ...fields, text: 'We walked on', revision: 2, updatedAt: second.updatedAt } });
    await expect(service.get(otherId)).resolves.toEqual({ draft: null });
    await expectApiError(service.save(otherId, { ...fields, baseRevision: 2 }), ConflictException, 'COMPOSER_DRAFT_CONFLICT');
  });

  it('refuses a device behind the stored revision, even when two save at once', async () => {
    await service.save(writerId, { ...fields, baseRevision: null });

    const results = await Promise.allSettled([
      service.save(writerId, { ...fields, text: 'Phone', baseRevision: 1 }),
      service.save(writerId, { ...fields, text: 'Laptop', baseRevision: 1 }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    await expectApiError(service.save(writerId, { ...fields, baseRevision: null }), ConflictException, 'COMPOSER_DRAFT_CONFLICT');

    const created = await Promise.allSettled([
      service.save(otherId, { ...fields, baseRevision: null }),
      service.save(otherId, { ...fields, baseRevision: null }),
    ]);
    expect(created.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  });

  it('discards only the revision a device saw, and a published draft refuses the device still on it', async () => {
    await service.save(writerId, { ...fields, baseRevision: null });
    await service.save(writerId, { ...fields, baseRevision: 1 });

    await expectApiError(service.discard(writerId, 1), ConflictException, 'COMPOSER_DRAFT_CONFLICT');
    await expect(service.discard(writerId, 2)).resolves.toEqual({ success: true });
    await expect(service.get(writerId)).resolves.toEqual({ draft: null });
    await expect(service.discard(writerId, 2)).resolves.toEqual({ success: true });
    await expectApiError(service.save(writerId, { ...fields, baseRevision: 2 }), ConflictException, 'COMPOSER_DRAFT_CONFLICT');
  });

  it('keeps the entry limits in the table too', async () => {
    await expect(dataSource.query(`INSERT INTO composer_drafts (user_id, content, format) VALUES ($1, 'x', 'html')`, [writerId])).rejects.toThrow();
    await expect(dataSource.query(`INSERT INTO composer_drafts (user_id, content, mood) VALUES ($1, 'x', 6)`, [writerId])).rejects.toThrow();
    await expect(dataSource.query(`INSERT INTO composer_drafts (user_id, content) VALUES ($1, repeat('x', 50001))`, [writerId])).rejects.toThrow();
  });

  it('goes with the account', async () => {
    await service.save(writerId, { ...fields, baseRevision: null });

    await dataSource.getRepository(User).delete({ id: writerId });

    await expect(dataSource.query('SELECT user_id FROM composer_drafts')).resolves.toEqual([]);
  });
});
