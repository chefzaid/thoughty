import { describeContract } from './contract-suite';
import { createEntry, defaultDiaryId, PNG_PIXEL } from './contract-fixtures';
import type { ContractUser } from './contract-client';

const MP3 = Buffer.from('ID3');

describeContract('local-transcripts', (context) => {
  const call: typeof context.client.call = (operation, options) => context.client.call(operation, options);

  /** Uploads a file onto the entry `entryId` (none: an upload no entry holds yet) and returns its id. */
  const upload = async (as: ContractUser, entryId: number | null, file = { buffer: MP3, filename: 'note.mp3', contentType: 'audio/mpeg' }) => {
    const response = await call('POST /api/attachments/upload', {
      as,
      multipart: { ...(entryId ? { fields: { entryId: String(entryId) } } : {}), files: [{ field: 'file', ...file }] },
      status: 201,
    });
    return (response.body as { id: number }).id;
  };

  it('keeps the transcript the writer’s own model made of a recording in a diary set to it, for its owner only', async () => {
    const { alice, bob } = context;
    const created = await call('POST /api/diaries', { as: alice, json: { name: 'Voice letters', icon: '🎙️', visibility: 'private', aiMode: 'local' }, status: 201 });
    const diaryId = (created.body as { id: number }).id;
    const entryId = await createEntry(context, alice, { text: 'A voice letter', diaryId });
    const recordingId = await upload(alice, entryId);
    const transcript = { as: alice, params: { id: recordingId } };

    // Thoughty's provider never gets it: the browser sends the recording to the writer's model instead
    await call('POST /api/attachments/{id}/transcribe', { ...transcript, status: 403, code: 'DIARY_AI_LOCAL' });

    await call('PUT /api/attachments/{id}/transcript', { as: bob, params: { id: recordingId }, json: { transcript: 'Not mine' }, status: 404, code: 'ATTACHMENT_NOT_FOUND' });
    await call('PUT /api/attachments/{id}/transcript', { ...transcript, json: { transcript: 'a'.repeat(50_001) }, status: 400, code: 'TRANSCRIPT_TOO_LONG' });
    await call('PUT /api/attachments/{id}/transcript', { ...transcript, json: { transcript: '  ' }, status: 400, code: 'VALIDATION_FAILED' });

    const stored = await call('PUT /api/attachments/{id}/transcript', { ...transcript, json: { transcript: ' Dear sister, I recorded this by the lake. ' }, status: 200 });
    expect(stored.body).toMatchObject({ transcript: 'Dear sister, I recorded this by the lake.', cached: false });

    // Kept where a transcript Thoughty made is: on the entry's attachment, and answered as stored from then on
    const list = await call('GET /api/entries', { as: alice, query: { diaryId: String(diaryId) }, status: 200 });
    const [entry] = (list.body as { entries: Array<{ attachments: Array<{ id: number; transcript: string | null }> }> }).entries;
    expect(entry?.attachments).toEqual([expect.objectContaining({ id: recordingId, transcript: 'Dear sister, I recorded this by the lake.' })]);
    const cached = await call('POST /api/attachments/{id}/transcribe', { ...transcript, status: 201 });
    expect(cached.body).toMatchObject({ transcript: 'Dear sister, I recorded this by the lake.', cached: true });

    const picture = await upload(alice, entryId, { buffer: PNG_PIXEL, filename: 'lake.png', contentType: 'image/png' });
    await call('PUT /api/attachments/{id}/transcript', { as: alice, params: { id: picture }, json: { transcript: 'A lake' }, status: 400, code: 'ATTACHMENT_NOT_AUDIO' });
    await call('DELETE /api/diaries/{id}', { as: alice, params: { id: diaryId }, status: 200 });
  });

  it('refuses a transcript for a recording of any other diary, or on no entry yet', async () => {
    const { alice } = context;
    const onEntry = await createEntry(context, alice, { text: 'Spoken notes', diaryId: await defaultDiaryId(context, alice) });
    for (const recordingId of [await upload(alice, onEntry), await upload(alice, null)]) {
      await call('PUT /api/attachments/{id}/transcript', {
        as: alice,
        params: { id: recordingId },
        json: { transcript: 'Made somewhere else' },
        status: 403,
        code: 'TRANSCRIPT_LOCAL_DIARY_ONLY',
      });
    }
  });
});
