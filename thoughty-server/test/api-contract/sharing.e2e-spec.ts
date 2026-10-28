import { describeContract } from './contract-suite';
import { createEntry, defaultDiaryId, PNG_PIXEL, todayIso } from './contract-fixtures';
import { jpegOf, VIDEO_HEADS } from '../../src/modules/attachments/video-fixtures.test-helpers';
import type { ContractUser } from './contract-client';

const MP4_CLIP = Buffer.concat([VIDEO_HEADS.mp4, Buffer.from('moov and mdat of a very short clip')]);
const POSTER = jpegOf(320, 180);
const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

interface CreatedLink {
  id: number;
  token: string;
  kind: string;
  viewCount: number;
}

describeContract('sharing', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);

  /** Uploads a file onto an entry, as the composer does, and returns its attachment id. */
  const upload = async (user: ContractUser, entryId: number, file: { buffer: Buffer; filename: string; contentType: string }) => {
    const response = await call('POST /api/attachments/upload', {
      as: user,
      multipart: { fields: { entryId: String(entryId) }, files: [{ field: 'file', ...file }] },
      status: 201,
    });
    return (response.body as { id: number }).id;
  };

  /** What the reader's page gets for a link that does not work: the same answer whatever the reason. */
  const expectUnavailable = async (token: string) => {
    const response = await call('GET /api/shared/{token}', { params: { token }, status: 404, code: 'SHARE_LINK_NOT_FOUND' });
    return response.body as unknown;
  };

  it('shares an entry with someone who is not signed in: its text and own files, never other data', async () => {
    const { alice, bob } = context;
    const entryId = await createEntry(context, alice, { text: 'We walked to the lighthouse.', title: 'Sea', tags: ['family'], mood: 4, format: 'markdown' });
    const otherEntryId = await createEntry(context, alice, { text: 'Another day' });
    const pictureId = await upload(alice, entryId, { buffer: PNG_PIXEL, filename: 'shell.png', contentType: 'image/png' });
    const videoId = await upload(alice, entryId, { buffer: MP4_CLIP, filename: 'waves.mp4', contentType: 'video/mp4' });
    await call('POST /api/attachments/{id}/poster', {
      as: alice,
      params: { id: videoId },
      multipart: { files: [{ field: 'file', buffer: POSTER, filename: 'poster.jpg', contentType: 'image/jpeg' }] },
      status: 201,
    });
    const otherPictureId = await upload(alice, otherEntryId, { buffer: PNG_PIXEL, filename: 'other.png', contentType: 'image/png' });

    await call('POST /api/share-links', { as: bob, json: { kind: 'entry', targetId: entryId, expiresAt: inDays(7) }, status: 404, code: 'ENTRY_NOT_FOUND' });
    await call('POST /api/share-links', { as: alice, json: { kind: 'entry', targetId: entryId, expiresAt: inDays(400) }, status: 400, code: 'SHARE_LINK_EXPIRY_INVALID' });
    await call('POST /api/share-links', { as: alice, json: { kind: 'diary', targetId: entryId, expiresAt: inDays(7) }, status: 400, code: 'VALIDATION_FAILED' });
    await call('POST /api/share-links', { as: alice, json: { kind: 'entry', targetId: entryId, expiresAt: inDays(7), maxViews: 0 }, status: 400, code: 'VALIDATION_FAILED' });

    const created = await call('POST /api/share-links', {
      as: alice,
      json: { kind: 'entry', targetId: entryId, expiresAt: inDays(7), label: '  For Mum ', showTags: true, maxViews: 5 },
      status: 201,
    });
    const link = created.body as CreatedLink & { label: string };
    expect(link).toMatchObject({ kind: 'entry', targetId: entryId, label: 'For Mum', showTags: true, showMood: false, maxViews: 5, viewCount: 0 });
    expect(link.token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // No access token: the reader only has the link
    const opened = await call('GET /api/shared/{token}', { params: { token: link.token }, status: 200 });
    expect(opened.headers['cache-control']).toBe('no-store');
    expect(opened.headers['referrer-policy']).toBe('no-referrer');
    expect(opened.headers['x-robots-tag']).toContain('noindex');
    expect(opened.body).toEqual({
      kind: 'entry',
      expiresAt: expect.any(String),
      bookVersion: null,
      entry: {
        date: todayIso(), timeOfDay: null, title: 'Sea', content: 'We walked to the lighthouse.', format: 'markdown',
        mood: null, feelings: [], tags: ['family'],
        attachments: [
          { id: pictureId, name: 'shell.png', mimetype: 'image/png', size: PNG_PIXEL.length, hasPoster: false },
          { id: videoId, name: 'waves.mp4', mimetype: 'video/mp4', size: MP4_CLIP.length, hasPoster: true },
        ],
      },
    });
    expect(JSON.stringify(opened.body)).not.toMatch(/stored_filename|diary|user/);

    const picture = await call('GET /api/shared/{token}/attachments/{attachmentId}', {
      params: { token: link.token, attachmentId: pictureId }, status: 200, contentType: /^image\/png/, binary: true,
    });
    expect(Buffer.compare(picture.body as Buffer, PNG_PIXEL)).toBe(0);
    expect(picture.headers['cross-origin-resource-policy']).toBe('same-origin');
    const part = await call('GET /api/shared/{token}/attachments/{attachmentId}', {
      params: { token: link.token, attachmentId: videoId }, headers: { Range: 'bytes=4-11' }, status: 206, contentType: /^video\/mp4/, binary: true,
    });
    expect((part.body as Buffer).toString('latin1')).toBe('ftypisom');
    await call('GET /api/shared/{token}/attachments/{attachmentId}/poster', {
      params: { token: link.token, attachmentId: videoId }, status: 200, contentType: /^image\/jpeg/,
    });
    // Another entry's file, even the writer's own, is not part of the link
    await call('GET /api/shared/{token}/attachments/{attachmentId}', {
      params: { token: link.token, attachmentId: otherPictureId }, status: 404, code: 'SHARE_LINK_NOT_FOUND',
    });
    await call('GET /api/shared/{token}/attachments/{attachmentId}/poster', {
      params: { token: link.token, attachmentId: pictureId }, status: 404, code: 'SHARE_LINK_NOT_FOUND',
    });
    await call('GET /api/shared/{token}/file', { params: { token: link.token }, status: 404, code: 'SHARE_LINK_NOT_FOUND' });

    const listed = await call('GET /api/share-links', { as: alice, query: { kind: 'entry', targetId: String(entryId) }, status: 200 });
    expect(listed.body).toEqual({ links: [expect.objectContaining({ id: link.id, viewCount: 1 })], limit: 100, activeCount: 1 });
    expect(JSON.stringify(listed.body)).not.toContain(link.token);
    await call('GET /api/share-links', { as: bob, query: { kind: 'entry', targetId: String(entryId) }, status: 404, code: 'ENTRY_NOT_FOUND' });

    await call('DELETE /api/share-links/{id}', { as: bob, params: { id: link.id }, status: 404, code: 'SHARE_LINK_NOT_FOUND' });
    await call('DELETE /api/share-links/{id}', { as: alice, params: { id: link.id }, status: 200 });
    // A revoked link reads exactly like one that never existed
    const revoked = await expectUnavailable(link.token);
    expect(await expectUnavailable('A'.repeat(43))).toEqual(revoked);
    expect(await expectUnavailable('not-a-token')).toEqual(revoked);
    await call('GET /api/shared/{token}/attachments/{attachmentId}', {
      params: { token: link.token, attachmentId: pictureId }, status: 404, code: 'SHARE_LINK_NOT_FOUND',
    });
  });

  it('stops an entry’s link when it goes to the recycle bin, and refuses sharing a sealed time capsule', async () => {
    const { alice } = context;
    const entryId = await createEntry(context, alice, { text: 'Binned later' });
    const link = (await call('POST /api/share-links', { as: alice, json: { kind: 'entry', targetId: entryId, expiresAt: inDays(1) }, status: 201 })).body as CreatedLink;
    await call('GET /api/shared/{token}', { params: { token: link.token }, status: 200 });

    await call('DELETE /api/entries/{id}', { as: alice, params: { id: entryId }, status: 200 });
    await expectUnavailable(link.token);
    await call('POST /api/recycle-bin/restore', { as: alice, json: { ids: [entryId] }, status: 200 });
    await expectUnavailable(link.token);

    const sealed = await call('POST /api/entries', {
      as: alice,
      json: { text: 'Dear future me', tags: [], date: todayIso(), visibility: 'private', format: 'plain', seal: { opensOn: todayIso(365), openHour: 9, timeZone: 'Europe/Paris' } },
      status: 201,
    });
    await call('POST /api/share-links', {
      as: alice, json: { kind: 'entry', targetId: (sealed.body as { entryId: number }).entryId, expiresAt: inDays(1) }, status: 409, code: 'ENTRY_SEALED',
    });
  });

  it('shares a book version as its stored file, as a download, up to its view limit', async () => {
    const { alice, bob } = context;
    await createEntry(context, alice, { text: 'A chapter of summer', tags: ['summer'] });
    const diaryId = String(await defaultDiaryId(context, alice));
    const version = (await call('POST /api/books/versions', { as: alice, query: { narrative: 'false', diaryId, format: 'md' }, status: 201 })).body as { id: number; title: string };

    await call('POST /api/share-links', { as: bob, json: { kind: 'bookVersion', targetId: version.id, expiresAt: inDays(30) }, status: 404, code: 'BOOK_VERSION_NOT_FOUND' });
    const link = (await call('POST /api/share-links', {
      as: alice, json: { kind: 'bookVersion', targetId: version.id, expiresAt: inDays(30), showMood: true, maxViews: 1 }, status: 201,
    })).body as CreatedLink & { showMood: boolean };
    expect(link).toMatchObject({ kind: 'bookVersion', targetId: version.id, showMood: false });

    const opened = await call('GET /api/shared/{token}', { params: { token: link.token }, status: 200 });
    expect(opened.body).toMatchObject({ kind: 'bookVersion', entry: null, bookVersion: { title: version.title, format: 'md', size: expect.any(Number) } });
    const file = await call('GET /api/shared/{token}/file', { params: { token: link.token }, status: 200, contentType: /^text\/markdown/ });
    expect(file.headers['content-disposition']).toMatch(/^attachment; /);
    expect(file.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
    expect(file.text).toContain('A chapter of summer');

    // Its one view is used: the link stops, and its listing says so
    await call('GET /api/shared/{token}/file', { params: { token: link.token }, status: 404, code: 'SHARE_LINK_NOT_FOUND' });
    await expectUnavailable(link.token);
    const listed = await call('GET /api/share-links', { as: alice, query: { kind: 'bookVersion', targetId: String(version.id) }, status: 200 });
    expect(listed.body).toMatchObject({ links: [{ id: link.id, viewCount: 1, maxViews: 1 }] });
  });
});
