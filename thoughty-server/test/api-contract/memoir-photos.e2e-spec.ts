import { describeContract } from './contract-suite';
import { PNG_PIXEL } from './contract-fixtures';
import { journalQuery } from './contract-journal';
import type { ContractUser } from './contract-client';

interface Overview {
  program: { diaryId: number };
  progress: { words: number };
  photoAnswers: Array<{ entryId: number; answeredAt: string }>;
}

describeContract('memoir-photos', (context) => {
  const call: typeof context.client.call = (operation, options) => context.client.call(operation, options);

  const upload = async (user: ContractUser, file = { buffer: PNG_PIXEL, filename: 'old-photo.png', contentType: 'image/png' }) => {
    const response = await call('POST /api/attachments/upload', { as: user, multipart: { files: [{ field: 'file', ...file }] }, status: 201 });
    return (response.body as { id: number }).id;
  };

  it('keeps an old photo and its story as a private memoir entry, the photo placed before the story', async () => {
    const { alice, bob } = context;
    const photoId = await upload(alice);
    await call('POST /api/memoir/photo-answers', { as: alice, json: { attachmentId: photoId, text: 'A wedding.' }, status: 404, code: 'MEMOIR_NOT_STARTED' });

    const started = (await call('POST /api/memoir', {
      as: alice,
      json: { diaryName: 'Family memoir', emailEnabled: false, deliveryWeekday: 1, timeZone: 'Europe/Paris' },
      status: 201,
    })).body as Overview;
    expect(started.photoAnswers).toEqual([]);

    await call('POST /api/memoir/photo-answers', { as: alice, json: { attachmentId: photoId, text: '   ' }, status: 400, code: 'MEMOIR_PHOTO_EMPTY' });
    await call('POST /api/memoir/photo-answers', { as: alice, json: { attachmentId: photoId, text: 'x', chapterId: 'hobbies' }, status: 400, code: 'VALIDATION_FAILED' });
    const saved = await call('POST /api/memoir/photo-answers', {
      as: alice,
      json: { attachmentId: photoId, caption: 'The church, June 1974', text: 'My parents marry in the rain.', chapterId: 'family' },
      status: 201,
    });
    const { entryId } = saved.body as { entryId: number };

    const overview = (await call('GET /api/memoir', { as: alice, status: 200 })).body as Overview;
    expect(overview.photoAnswers).toEqual([{ entryId, answeredAt: expect.any(String) }]);
    expect(overview.progress.words).toBe(6);
    const listed = await call('GET /api/entries', { as: alice, query: journalQuery({ diaryId: String(overview.program.diaryId) }), status: 200 });
    expect((listed.body as { entries: unknown[] }).entries).toEqual([
      expect.objectContaining({
        id: entryId,
        content: `### What is happening here?\n\n![The church, June 1974](attachment:${photoId})\n\nMy parents marry in the rain.`,
        tags: ['Family'],
        visibility: 'private',
        format: 'markdown',
        attachments: [expect.objectContaining({ id: photoId })],
      }),
    ]);

    // The photo is now on that entry; another writer's photo, and a file that is no picture, start no story
    await call('POST /api/memoir/photo-answers', { as: alice, json: { attachmentId: photoId, text: 'Again.' }, status: 409, code: 'MEMOIR_PHOTO_IN_USE' });
    await call('POST /api/memoir/photo-answers', { as: alice, json: { attachmentId: await upload(bob), text: 'Not mine.' }, status: 404, code: 'ATTACHMENT_NOT_FOUND' });
    const textId = await upload(alice, { buffer: Buffer.from('a letter'), filename: 'letter.txt', contentType: 'text/plain' });
    await call('POST /api/memoir/photo-answers', { as: alice, json: { attachmentId: textId, text: 'A letter.' }, status: 400, code: 'MEMOIR_PHOTO_NOT_IMAGE' });
    await call('POST /api/memoir/photo-answers', { json: { attachmentId: photoId, text: 'x' }, status: 401, code: 'UNAUTHORIZED' });
  });
});
