import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { BookVersion, Entry, ShareLink } from '@/database/entities';
import { SHARE_LINK_LIMIT } from './dto';
import { hashShareToken } from './share-link-token';
import { ShareLinksService, toShareLinkResponse } from './share-links.service';

const now = new Date('2026-10-28T09:00:00Z');
const inDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

describe('ShareLinksService', () => {
  let linkRepository: Record<string, jest.Mock> & { manager?: unknown };
  let entryRepository: { findOne: jest.Mock; exists: jest.Mock };
  let bookVersionRepository: { exists: jest.Mock };
  let deleteBuilder: Record<string, jest.Mock>;
  let manager: { query: jest.Mock; getRepository: jest.Mock };
  let service: ShareLinksService;

  beforeEach(() => {
    deleteBuilder = {
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    entryRepository = { findOne: jest.fn().mockResolvedValue({ id: 12, sealedUntil: null }), exists: jest.fn().mockResolvedValue(true) };
    bookVersionRepository = { exists: jest.fn().mockResolvedValue(true) };
    linkRepository = {
      createQueryBuilder: jest.fn(() => deleteBuilder),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 7, viewCount: 0, lastViewedAt: null, createdAt: now, ...value })),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
    };
    manager = {
      query: jest.fn().mockResolvedValue([]),
      getRepository: jest.fn((entity) => {
        if (entity === Entry) return entryRepository;
        if (entity === BookVersion) return bookVersionRepository;
        return linkRepository;
      }),
    };
    linkRepository.manager = { transaction: jest.fn((work) => work(manager)), getRepository: manager.getRepository };
    service = new ShareLinksService(linkRepository as never);
  });

  it('makes an entry link with a fresh token, keeping only its hash, under the writer’s lock', async () => {
    const created = await service.create(3, {
      kind: 'entry', targetId: 12, expiresAt: inDays(7), label: 'For Mum', showMood: true, showTags: false, maxViews: 5,
    }, now);

    expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1), $2)', ['share_links', 3]);
    expect(entryRepository.findOne).toHaveBeenCalledWith({ select: { id: true, sealedUntil: true }, where: { id: 12, userId: 3 } });
    const saved = linkRepository.save.mock.calls[0][0] as ShareLink;
    expect(saved).toEqual(expect.objectContaining({
      userId: 3, entryId: 12, bookVersionId: null, label: 'For Mum', showMood: true, showTags: false, maxViews: 5,
      expiresAt: new Date(inDays(7)),
    }));
    expect(saved.tokenHash).toBe(hashShareToken(created.token));
    expect(created).toEqual(expect.objectContaining({ id: 7, kind: 'entry', targetId: 12, viewCount: 0, token: expect.stringMatching(/^[\w-]{43}$/) }));
    expect(JSON.stringify(created)).not.toContain(saved.tokenHash);
    expect(deleteBuilder.andWhere).toHaveBeenCalledWith('expires_at <= now()');
  });

  it('shares a book version as its file only: no mood, tags, label or limit unless given', async () => {
    const created = await service.create(3, { kind: 'bookVersion', targetId: 9, expiresAt: inDays(30), showMood: true, showTags: true }, now);

    expect(bookVersionRepository.exists).toHaveBeenCalledWith({ where: { id: 9, userId: 3 } });
    expect(linkRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      entryId: null, bookVersionId: 9, showMood: false, showTags: false, label: null, maxViews: null,
    }));
    expect(created.kind).toBe('bookVersion');
    expect(created.targetId).toBe(9);
  });

  it('refuses an expiry under an hour or over a year ahead', async () => {
    for (const expiresAt of [inDays(-1), new Date(now.getTime() + 59 * 60 * 1000).toISOString(), inDays(367)]) {
      await expectApiError(service.create(3, { kind: 'entry', targetId: 12, expiresAt }, now), BadRequestException, 'SHARE_LINK_EXPIRY_INVALID');
    }
    await expect(service.create(3, { kind: 'entry', targetId: 12, expiresAt: inDays(366) }, now)).resolves.toBeDefined();
    expect(linkRepository.save).toHaveBeenCalledTimes(1);
  });

  it('refuses another writer’s entry or book, a sealed time capsule, and the link past the limit', async () => {
    entryRepository.findOne.mockResolvedValueOnce(null);
    await expectApiError(service.create(3, { kind: 'entry', targetId: 12, expiresAt: inDays(1) }, now), NotFoundException, 'ENTRY_NOT_FOUND');
    bookVersionRepository.exists.mockResolvedValueOnce(false);
    await expectApiError(service.create(3, { kind: 'bookVersion', targetId: 9, expiresAt: inDays(1) }, now), NotFoundException, 'BOOK_VERSION_NOT_FOUND');
    entryRepository.findOne.mockResolvedValueOnce({ id: 12, sealedUntil: new Date('2030-01-01') });
    await expectApiError(service.create(3, { kind: 'entry', targetId: 12, expiresAt: inDays(1) }, now), ConflictException, 'ENTRY_SEALED');
    linkRepository.count.mockResolvedValueOnce(SHARE_LINK_LIMIT);
    await expectApiError(service.create(3, { kind: 'entry', targetId: 12, expiresAt: inDays(1) }, now), BadRequestException, 'SHARE_LINK_LIMIT_REACHED');
    expect(linkRepository.save).not.toHaveBeenCalled();
  });

  it('lists the unexpired links of one of the writer’s own entries or books, with the limit', async () => {
    const link = { id: 7, entryId: 12, bookVersionId: null, label: null, showMood: false, showTags: true, maxViews: null, viewCount: 1, lastViewedAt: now, expiresAt: now, createdAt: now } as ShareLink;
    linkRepository.find.mockResolvedValue([link]);
    linkRepository.count.mockResolvedValue(4);

    await expect(service.list(3, 'entry', 12)).resolves.toEqual({ links: [toShareLinkResponse(link)], limit: SHARE_LINK_LIMIT, activeCount: 4 });
    expect(linkRepository.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 3, entryId: 12 }),
      order: { createdAt: 'DESC', id: 'DESC' },
    }));

    await service.list(3, 'bookVersion', 9);
    expect(linkRepository.find).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 3, bookVersionId: 9 }) }));

    entryRepository.exists.mockResolvedValueOnce(false);
    await expectApiError(service.list(3, 'entry', 12), NotFoundException, 'ENTRY_NOT_FOUND');
  });

  it('revokes only the writer’s own link', async () => {
    linkRepository.delete.mockResolvedValueOnce({ affected: 1 }).mockResolvedValueOnce({ affected: 0 });

    await expect(service.revoke(3, 7)).resolves.toEqual({ success: true });
    expect(linkRepository.delete).toHaveBeenCalledWith({ id: 7, userId: 3 });
    await expectApiError(service.revoke(4, 7), NotFoundException, 'SHARE_LINK_NOT_FOUND');
  });

  it('describes a book link by its version', () => {
    expect(toShareLinkResponse({ id: 1, entryId: null, bookVersionId: 9 } as ShareLink)).toEqual(expect.objectContaining({ kind: 'bookVersion', targetId: 9 }));
  });
});
