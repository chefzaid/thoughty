import { NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { createShareToken, hashShareToken } from './share-link-token';
import { SharedContentService } from './shared-content.service';

const expiresAt = new Date('2026-11-04T09:00:00Z');
const token = createShareToken();

/** A link row as the lookup reads it. */
const liveRow = (overrides: Record<string, unknown> = {}) => ({
  id: 7, user_id: 3, entry_id: 12, book_version_id: null, show_mood: false, show_tags: false,
  expires_at: expiresAt, views_left: true, just_viewed: false, ...overrides,
});

const entry = {
  id: 12, userId: 3, date: '2026-10-27', timeOfDay: '08:30', title: 'Sea', content: 'We walked ![shell](attachment:31)',
  format: 'markdown', mood: 4, feelings: ['calm'], tags: ['family'], sealedUntil: null,
  attachments: [
    { id: 32, originalFilename: 'clip.mp4', mimetype: 'video/mp4', size: 900, posterFilename: 'p.jpg' },
    { id: 31, originalFilename: 'shell.jpg', mimetype: 'image/jpeg', size: 400, posterFilename: null },
  ],
};

describe('SharedContentService', () => {
  let linkRepository: { query: jest.Mock; createQueryBuilder: jest.Mock };
  let updateBuilder: Record<string, jest.Mock>;
  let entryRepository: { findOne: jest.Mock };
  let attachmentRepository: { findOne: jest.Mock };
  let bookVersionRepository: { query: jest.Mock; createQueryBuilder: jest.Mock };
  let bookBuilder: Record<string, jest.Mock>;
  let service: SharedContentService;

  beforeEach(() => {
    updateBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    bookBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ content: Buffer.from('book'), filename: 'summer.pdf', contentType: 'application/pdf' }),
    };
    linkRepository = { query: jest.fn().mockResolvedValue([liveRow()]), createQueryBuilder: jest.fn(() => updateBuilder) };
    entryRepository = { findOne: jest.fn().mockResolvedValue(entry) };
    attachmentRepository = { findOne: jest.fn() };
    bookVersionRepository = {
      query: jest.fn().mockResolvedValue([{ title: 'Summer', author: null, format: 'pdf', filename: 'summer.pdf', size: 4 }]),
      createQueryBuilder: jest.fn(() => bookBuilder),
    };
    service = new SharedContentService(linkRepository as never, entryRepository as never, attachmentRepository as never, bookVersionRepository as never);
  });

  it('opens an entry by the hash of its token, counting a view, without its mood or tags unless chosen', async () => {
    const shared = await service.open(token);

    expect(linkRepository.query).toHaveBeenCalledWith(expect.stringContaining('l.token_hash = $1'), [hashShareToken(token)]);
    expect(linkRepository.query.mock.calls[0][0]).toEqual(expect.stringContaining('e.deleted_at IS NULL AND e.sealed_until IS NULL'));
    expect(linkRepository.query.mock.calls[0][0]).toEqual(expect.stringContaining('u.deleted_at IS NULL'));
    expect(updateBuilder.andWhere).toHaveBeenCalledWith('(max_views IS NULL OR view_count < max_views)');
    expect(shared).toEqual({
      kind: 'entry',
      expiresAt,
      bookVersion: null,
      entry: {
        date: '2026-10-27', timeOfDay: '08:30', title: 'Sea', content: 'We walked ![shell](attachment:31)', format: 'markdown',
        mood: null, feelings: [], tags: [],
        attachments: [
          { id: 31, name: 'shell.jpg', mimetype: 'image/jpeg', size: 400, hasPoster: false },
          { id: 32, name: 'clip.mp4', mimetype: 'video/mp4', size: 900, hasPoster: true },
        ],
      },
    });
    expect(JSON.stringify(shared)).not.toMatch(/stored|userId|"id":12/);
  });

  it('shows the mood, feelings and tags the writer chose to show', async () => {
    linkRepository.query.mockResolvedValue([liveRow({ show_mood: true, show_tags: true })]);
    const { entry: shared } = await service.open(token);

    expect(shared).toEqual(expect.objectContaining({ mood: 4, feelings: ['calm'], tags: ['family'] }));
  });

  it('answers the same 404 for a malformed, unknown, expired or used-up token, and an entry that was hidden meanwhile', async () => {
    await expectApiError(service.open('not-a-token'), NotFoundException, 'SHARE_LINK_NOT_FOUND');
    expect(linkRepository.query).not.toHaveBeenCalled();

    linkRepository.query.mockResolvedValueOnce([]);
    await expectApiError(service.open(token), NotFoundException, 'SHARE_LINK_NOT_FOUND');

    updateBuilder.execute.mockResolvedValueOnce({ affected: 0 });
    await expectApiError(service.open(token), NotFoundException, 'SHARE_LINK_NOT_FOUND');

    entryRepository.findOne.mockResolvedValueOnce({ ...entry, sealedUntil: new Date() });
    await expectApiError(service.open(token), NotFoundException, 'SHARE_LINK_NOT_FOUND');
  });

  it('describes a book without counting a view, and counts the download', async () => {
    linkRepository.query.mockResolvedValue([liveRow({ entry_id: null, book_version_id: 9 })]);

    await expect(service.open(token)).resolves.toEqual({
      kind: 'bookVersion', expiresAt, entry: null, bookVersion: { title: 'Summer', author: null, format: 'pdf', filename: 'summer.pdf', size: 4 },
    });
    expect(updateBuilder.execute).not.toHaveBeenCalled();

    await expect(service.downloadBook(token)).resolves.toEqual({ content: Buffer.from('book'), filename: 'summer.pdf', contentType: 'application/pdf' });
    expect(updateBuilder.execute).toHaveBeenCalledTimes(1);
    expect(bookBuilder.where).toHaveBeenCalledWith('version.id = :id', { id: 9 });
  });

  it('refuses a book with no views left, a missing version, and a download through an entry link', async () => {
    linkRepository.query.mockResolvedValue([liveRow({ entry_id: null, book_version_id: 9, views_left: false })]);
    await expectApiError(service.open(token), NotFoundException, 'SHARE_LINK_NOT_FOUND');

    linkRepository.query.mockResolvedValue([liveRow({ entry_id: null, book_version_id: 9 })]);
    bookVersionRepository.query.mockResolvedValueOnce([]);
    await expectApiError(service.open(token), NotFoundException, 'SHARE_LINK_NOT_FOUND');
    bookBuilder.getOne.mockResolvedValueOnce(null);
    await expectApiError(service.downloadBook(token), NotFoundException, 'SHARE_LINK_NOT_FOUND');

    linkRepository.query.mockResolvedValue([liveRow()]);
    await expectApiError(service.downloadBook(token), NotFoundException, 'SHARE_LINK_NOT_FOUND');
  });

  it('serves only the shared entry’s own files and poster frames', async () => {
    attachmentRepository.findOne.mockResolvedValue({
      id: 32, storedFilename: 'k.mp4', posterFilename: 'p.jpg', posterSize: 20, originalFilename: 'clip.mp4', mimetype: 'video/mp4', size: 900,
    });

    await expect(service.attachmentFile(token, 32, 'file')).resolves.toEqual(expect.objectContaining({ key: 'k.mp4', contentType: 'video/mp4', inline: true }));
    expect(attachmentRepository.findOne).toHaveBeenCalledWith({ where: { id: 32, entryId: 12, userId: 3 } });
    await expect(service.attachmentFile(token, 32, 'poster')).resolves.toEqual(expect.objectContaining({ key: 'p.jpg', contentType: 'image/jpeg' }));

    attachmentRepository.findOne.mockResolvedValueOnce({ id: 31, storedFilename: 'k.jpg', posterFilename: null });
    await expectApiError(service.attachmentFile(token, 31, 'poster'), NotFoundException, 'SHARE_LINK_NOT_FOUND');
    attachmentRepository.findOne.mockResolvedValueOnce(null);
    await expectApiError(service.attachmentFile(token, 99, 'file'), NotFoundException, 'SHARE_LINK_NOT_FOUND');
  });

  it('keeps the last allowed view’s files loading for a moment, then refuses them, and refuses them through a book link', async () => {
    attachmentRepository.findOne.mockResolvedValue({ id: 31, storedFilename: 'k.jpg', posterFilename: null, originalFilename: 'a.jpg', mimetype: 'image/jpeg', size: 1 });

    linkRepository.query.mockResolvedValueOnce([liveRow({ views_left: false, just_viewed: true })]);
    await expect(service.attachmentFile(token, 31, 'file')).resolves.toEqual(expect.objectContaining({ key: 'k.jpg' }));
    linkRepository.query.mockResolvedValueOnce([liveRow({ views_left: false, just_viewed: false })]);
    await expectApiError(service.attachmentFile(token, 31, 'file'), NotFoundException, 'SHARE_LINK_NOT_FOUND');
    linkRepository.query.mockResolvedValueOnce([liveRow({ entry_id: null, book_version_id: 9 })]);
    await expectApiError(service.attachmentFile(token, 31, 'file'), NotFoundException, 'SHARE_LINK_NOT_FOUND');
  });
});
