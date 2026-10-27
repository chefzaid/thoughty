import JSZip from 'jszip';
import { CONTRACT_BUCKET } from './contract-app';
import { describeContract } from './contract-suite';
import { createEntry, PNG_PIXEL } from './contract-fixtures';
import { jpegOf, VIDEO_HEADS } from '../../src/modules/attachments/video-fixtures.test-helpers';

/** A short MP4 as a phone records it, as far as the signature check reads. */
const MP4_CLIP = Buffer.concat([VIDEO_HEADS.mp4, Buffer.from('moov and mdat of a very short clip')]);
const POSTER = jpegOf(320, 180);

interface Uploaded {
  id: number;
  stored_filename: string;
  mimetype: string;
  poster_filename?: string | null;
}

function binary(response: { body: unknown }): Buffer {
  return response.body as Buffer;
}

describeContract('media', (context) => {
  const call: typeof context.client.call = (operation, options) =>
    context.client.call(operation, options);

  it('takes a video by its bytes, stores its poster frame under the same owner, and serves byte ranges for seeking', async () => {
    const { alice, bob } = context;
    const entryId = await createEntry(context, alice, { text: 'A day at the beach', date: '2024-07-01', format: 'markdown' });

    await call('POST /api/attachments/upload', {
      as: alice,
      multipart: { files: [{ field: 'file', buffer: Buffer.from('<html>not a video</html>'), filename: 'page.mp4', contentType: 'video/mp4' }] },
      status: 400,
      code: 'ATTACHMENT_CONTENT_MISMATCH',
    });
    // An iPhone may declare a movie as QuickTime; the bytes say what it is
    const uploaded = await call('POST /api/attachments/upload', {
      as: alice,
      multipart: {
        fields: { entryId: String(entryId) },
        files: [{ field: 'file', buffer: MP4_CLIP, filename: 'beach.mov', contentType: 'video/quicktime' }],
      },
      status: 201,
    });
    const video = uploaded.body as Uploaded;
    expect(video.mimetype).toBe('video/mp4');

    const picture = (
      await call('POST /api/attachments/upload', {
        as: alice,
        multipart: { files: [{ field: 'file', buffer: PNG_PIXEL, filename: 'shell.png', contentType: 'image/png' }] },
        status: 201,
      })
    ).body as Uploaded;
    const poster = { field: 'file', buffer: POSTER, filename: 'poster.jpg', contentType: 'image/jpeg' };
    await call('POST /api/attachments/{id}/poster', {
      as: bob,
      params: { id: video.id },
      multipart: { files: [poster] },
      status: 404,
      code: 'ATTACHMENT_NOT_FOUND',
    });
    await call('POST /api/attachments/{id}/poster', {
      as: alice,
      params: { id: picture.id },
      multipart: { files: [poster] },
      status: 400,
      code: 'ATTACHMENT_NOT_VIDEO',
    });
    await call('POST /api/attachments/{id}/poster', {
      as: alice,
      params: { id: video.id },
      multipart: { files: [{ ...poster, buffer: PNG_PIXEL, contentType: 'image/png' }] },
      status: 400,
      code: 'ATTACHMENT_TYPE_NOT_ALLOWED',
    });
    const withPoster = (
      await call('POST /api/attachments/{id}/poster', {
        as: alice,
        params: { id: video.id },
        multipart: { files: [poster] },
        status: 201,
      })
    ).body as Uploaded;
    const posterKey = withPoster.poster_filename as string;
    expect(posterKey).toMatch(/\.jpg$/);
    expect(context.api.storage.keys(CONTRACT_BUCKET)).toEqual(expect.arrayContaining([video.stored_filename, posterKey]));

    const servedPoster = await call('GET /api/attachments/file/{filename}', {
      as: alice,
      params: { filename: posterKey },
      status: 200,
      contentType: /^image\/jpeg/,
      binary: true,
    });
    expect(Buffer.compare(binary(servedPoster), POSTER)).toBe(0);
    await call('GET /api/attachments/file/{filename}', {
      as: bob,
      params: { filename: posterKey },
      status: 404,
      code: 'ATTACHMENT_FILE_NOT_FOUND',
    });

    const whole = await call('GET /api/attachments/file/{filename}', {
      as: alice,
      params: { filename: video.stored_filename },
      status: 200,
      contentType: /^video\/mp4/,
    });
    expect(whole.headers['accept-ranges']).toBe('bytes');
    expect(whole.headers['content-disposition']).toMatch(/^inline; /);
    const part = await call('GET /api/attachments/file/{filename}', {
      as: alice,
      params: { filename: video.stored_filename },
      headers: { Range: 'bytes=4-11' },
      status: 206,
      contentType: /^video\/mp4/,
      binary: true,
    });
    expect(part.headers['content-range']).toBe(`bytes 4-11/${MP4_CLIP.length}`);
    expect(binary(part).toString('latin1')).toBe('ftypisom');
    const outside = await call('GET /api/attachments/file/{filename}', {
      as: alice,
      params: { filename: video.stored_filename },
      headers: { Range: `bytes=${MP4_CLIP.length}-` },
      status: 416,
      code: 'ATTACHMENT_RANGE_NOT_SATISFIABLE',
    });
    expect(outside.headers['content-range']).toBe(`bytes */${MP4_CLIP.length}`);

    const listed = await call('GET /api/entries', {
      as: alice,
      query: { page: '1', limit: '10', search: '', tags: '', date: '', visibility: '', archiveStatus: 'active' },
      status: 200,
    });
    const entry = (listed.body as { entries: { id: number; attachments: Uploaded[] }[] }).entries.find((item) => item.id === entryId);
    expect(entry?.attachments).toEqual([expect.objectContaining({ id: video.id, poster_filename: posterKey })]);

    // The Markdown folder carries the video itself, never its poster frame
    const folder = await call('GET /api/io/export', { as: alice, query: { format: 'zip' }, status: 200, contentType: /^application\/zip/, binary: true });
    const zip = await JSZip.loadAsync(binary(folder));
    const files = Object.keys(zip.files);
    expect(files.filter((name) => name.endsWith('-beach.mov'))).toHaveLength(1);
    expect(files.some((name) => name.endsWith('.jpg'))).toBe(false);

    // Deleting the entry forever from the recycle bin deletes the video and its poster frame
    await call('DELETE /api/entries/{id}', { as: alice, params: { id: entryId }, status: 200 });
    await call('POST /api/recycle-bin/delete', { as: alice, json: { ids: [entryId] }, status: 200 });
    const keys = context.api.storage.keys(CONTRACT_BUCKET);
    expect(keys).not.toContain(video.stored_filename);
    expect(keys).not.toContain(posterKey);
  });
});
