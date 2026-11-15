import { describeContract } from './contract-suite';

interface Draft {
  text: string;
  revision: number;
  updatedAt: string;
}

const fields = { text: 'We walked along the river', title: 'Evening walk', tags: ['walks'], format: 'plain', mood: 4, feelings: ['calm'] };

describeContract('drafts', (context) => {
  const call: typeof context.client.call = (operation, options) => context.client.call(operation, options);

  it('continues a draft on another device, refuses a device behind it, and discards it once published', async () => {
    const { alice, bob } = context;
    await expect(call('GET /api/composer-draft', { as: alice, status: 200 })).resolves.toMatchObject({ body: { draft: null } });

    // The phone starts the draft, the laptop reads it and writes on top of it
    const phone = (await call('PUT /api/composer-draft', { as: alice, json: { ...fields, baseRevision: null }, status: 200 })).body as Draft;
    expect(phone).toMatchObject({ ...fields, revision: 1 });
    const loaded = (await call('GET /api/composer-draft', { as: alice, status: 200 })).body as { draft: Draft };
    expect(loaded.draft).toEqual(phone);
    const laptop = (await call('PUT /api/composer-draft', {
      as: alice, json: { ...fields, text: `${fields.text} until dark`, baseRevision: loaded.draft.revision }, status: 200,
    })).body as Draft;
    expect(laptop.revision).toBe(2);

    // The phone, still on revision 1, cannot overwrite or discard the newer text
    await call('PUT /api/composer-draft', { as: alice, json: { ...fields, baseRevision: 1 }, status: 409, code: 'COMPOSER_DRAFT_CONFLICT' });
    await call('PUT /api/composer-draft', { as: alice, json: { ...fields, baseRevision: null }, status: 409, code: 'COMPOSER_DRAFT_CONFLICT' });
    await call('DELETE /api/composer-draft', { as: alice, query: { revision: '1' }, status: 409, code: 'COMPOSER_DRAFT_CONFLICT' });

    // Each writer has their own
    await expect(call('GET /api/composer-draft', { as: bob, status: 200 })).resolves.toMatchObject({ body: { draft: null } });
    await call('PUT /api/composer-draft', { as: bob, json: { ...fields, baseRevision: 2 }, status: 409, code: 'COMPOSER_DRAFT_CONFLICT' });

    await call('DELETE /api/composer-draft', { as: alice, query: { revision: '2' }, status: 200 });
    await expect(call('GET /api/composer-draft', { as: alice, status: 200 })).resolves.toMatchObject({ body: { draft: null } });
    await call('DELETE /api/composer-draft', { as: alice, status: 200 });
  });

  it('keeps the entry limits and is in the data download', async () => {
    const { alice } = context;
    await call('PUT /api/composer-draft', { as: alice, json: { ...fields, text: 'x'.repeat(50_001), baseRevision: null }, status: 400, code: 'VALIDATION_FAILED' });
    await call('PUT /api/composer-draft', { as: alice, json: { ...fields, mood: 6, baseRevision: null }, status: 400, code: 'VALIDATION_FAILED' });
    await call('PUT /api/composer-draft', { as: alice, json: { ...fields }, status: 400, code: 'VALIDATION_FAILED' });

    await call('PUT /api/composer-draft', { as: alice, json: { ...fields, baseRevision: null }, status: 200 });
    const download = await call('GET /api/config/download-data', { as: alice, status: 200, contentType: /^application\/json/ });
    const data = download.body as { composerDraft: { content: string; revision: number } };
    expect(data.composerDraft).toMatchObject({ content: fields.text, revision: 1 });
    await call('DELETE /api/composer-draft', { as: alice, status: 200 });
  });

  it('needs a signed-in writer', async () => {
    await call('GET /api/composer-draft', { status: 401, code: 'UNAUTHORIZED' });
    await call('PUT /api/composer-draft', { json: { ...fields, baseRevision: null }, status: 401, code: 'UNAUTHORIZED' });
    await call('DELETE /api/composer-draft', { status: 401, code: 'UNAUTHORIZED' });
  });
});
