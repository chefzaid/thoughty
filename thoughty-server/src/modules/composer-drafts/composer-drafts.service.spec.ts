import { ConflictException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { ComposerDraftsService } from './composer-drafts.service';

const fields = { text: 'We walked', title: 'Walk', tags: ['walks'], format: 'plain' as const, mood: 4, feelings: ['calm'] };

describe('ComposerDraftsService', () => {
  const repository = { findOne: jest.fn(), query: jest.fn(), delete: jest.fn(), exists: jest.fn() };
  const service = new ComposerDraftsService(repository as never);
  const updatedAt = new Date('2026-11-15T09:30:00Z');

  beforeEach(() => jest.clearAllMocks());

  it('answers the stored draft by its response names, or null', async () => {
    repository.findOne.mockResolvedValueOnce({
      userId: 7, content: 'We walked', title: null, tags: [], format: 'markdown', mood: null, feelings: [], revision: 2, updatedAt,
    });
    await expect(service.get(7)).resolves.toEqual({
      draft: { text: 'We walked', title: null, tags: [], format: 'markdown', mood: null, feelings: [], revision: 2, updatedAt },
    });
    expect(repository.findOne).toHaveBeenCalledWith({ where: { userId: 7 } });

    repository.findOne.mockResolvedValueOnce(null);
    await expect(service.get(7)).resolves.toEqual({ draft: null });
  });

  it('creates the first draft only when there is none, and keeps an empty title as none', async () => {
    const saved = { ...fields, title: null, revision: 1, updatedAt };
    repository.query.mockResolvedValueOnce([saved]);

    await expect(service.save(7, { ...fields, title: '', baseRevision: null })).resolves.toEqual(saved);
    const [sql, params] = repository.query.mock.calls[0];
    expect(sql).toContain('ON CONFLICT (user_id) DO NOTHING');
    expect(params).toEqual([7, 'We walked', null, ['walks'], 'plain', 4, ['calm']]);
  });

  it('moves the draft one revision on only from the revision the device saw', async () => {
    repository.query.mockResolvedValueOnce([[{ ...fields, revision: 4, updatedAt }], 1]);

    await expect(service.save(7, { ...fields, baseRevision: 3 })).resolves.toMatchObject({ revision: 4 });
    const [sql, params] = repository.query.mock.calls[0];
    expect(sql).toContain('revision = revision + 1');
    expect(sql).toContain('WHERE user_id = $1 AND revision = $8');
    expect(params).toEqual([7, 'We walked', 'Walk', ['walks'], 'plain', 4, ['calm'], 3]);
  });

  it('refuses a save on top of a revision that is no longer the stored one', async () => {
    repository.query.mockResolvedValueOnce([[], 0]).mockResolvedValueOnce([]);

    await expectApiError(service.save(7, { ...fields, baseRevision: 3 }), ConflictException, 'COMPOSER_DRAFT_CONFLICT');
    await expectApiError(service.save(7, { ...fields, baseRevision: null }), ConflictException, 'COMPOSER_DRAFT_CONFLICT');
  });

  it('discards the draft, at any revision or only at the one given', async () => {
    repository.delete.mockResolvedValue({ affected: 1 });

    await expect(service.discard(7)).resolves.toEqual({ success: true });
    expect(repository.delete).toHaveBeenLastCalledWith({ userId: 7 });
    await expect(service.discard(7, 3)).resolves.toEqual({ success: true });
    expect(repository.delete).toHaveBeenLastCalledWith({ userId: 7, revision: 3 });
    expect(repository.exists).not.toHaveBeenCalled();
  });

  it('keeps a newer draft than the revision given, and takes a draft already gone as discarded', async () => {
    repository.delete.mockResolvedValue({ affected: 0 });
    repository.exists.mockResolvedValueOnce(true);

    await expectApiError(service.discard(7, 3), ConflictException, 'COMPOSER_DRAFT_CONFLICT');
    expect(repository.exists).toHaveBeenCalledWith({ where: { userId: 7 } });

    repository.exists.mockResolvedValueOnce(false);
    await expect(service.discard(7, 3)).resolves.toEqual({ success: true });
    await expect(service.discard(7)).resolves.toEqual({ success: true });
  });
});
