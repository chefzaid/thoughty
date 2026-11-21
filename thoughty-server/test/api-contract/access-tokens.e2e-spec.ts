import { describeContract, registerWriter, CONTRACT_PASSWORD } from './contract-suite';
import { createEntry, defaultDiaryId } from './contract-fixtures';
import type { ContractUser } from './contract-client';

interface CreatedToken {
  id: number;
  name: string;
  hint: string;
  scopes: string[];
  token: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

/** Today in a time zone, as `YYYY-MM-DD`. */
const dayIn = (timeZone: string) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());

describeContract('access-tokens', (context) => {
  const call: typeof context.client.call = (operation, options) => context.client.call(operation, options);
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const makeToken = async (as: ContractUser, scopes: string[], changes: Record<string, unknown> = {}) =>
    (await call('POST /api/access-tokens', {
      as,
      json: { name: `Script ${scopes.join(' ')}`, scopes, expiresInDays: 30, timeZone: 'Pacific/Kiritimati', ...changes },
      status: 201,
    })).body as CreatedToken;

  it('makes a token shown once, writes private entries with it for its time zone’s day, and lists its diaries', async () => {
    const { alice } = context;
    const created = await makeToken(alice, ['entries:write'], { name: 'iPhone Shortcut', expiresInDays: null });
    expect(created).toMatchObject({ name: 'iPhone Shortcut', scopes: ['entries:write'], expiresAt: null, lastUsedAt: null });
    expect(created.token).toMatch(/^thy_[\w-]{43}$/);
    expect(created.hint).toBe(created.token.slice(0, 8));

    const listed = (await call('GET /api/access-tokens', { as: alice, status: 200 })).body as { tokens: CreatedToken[]; limit: number };
    expect(listed.limit).toBe(10);
    expect(listed.tokens).toEqual([expect.objectContaining({ id: created.id, hint: created.hint })]);
    expect(JSON.stringify(listed)).not.toContain(created.token);

    const diaries = (await call('GET /api/v1/diaries', { headers: bearer(created.token), status: 200 })).body as { diaries: { id: number; isDefault: boolean }[] };
    const defaultDiary = await defaultDiaryId(context, alice);
    expect(diaries.diaries).toEqual([expect.objectContaining({ id: defaultDiary, isDefault: true, isLocked: false })]);

    const written = await call('POST /api/v1/entries', {
      headers: bearer(created.token),
      json: { text: 'Walked by the river', title: 'Morning', mood: 4, tags: ['walk'] },
      status: 201,
    });
    const entry = written.body as { id: number; date: string };
    expect(entry.date).toBe(dayIn('Pacific/Kiritimati'));
    const older = await call('POST /api/v1/entries', {
      headers: bearer(created.token),
      json: { text: 'From an old notebook', date: '2020-01-02', tags: ['notebook'], diaryId: defaultDiary },
      status: 201,
    });
    expect(older.body).toMatchObject({ date: '2020-01-02' });

    const journal = (await call('GET /api/entries', { as: alice, query: { search: 'river' }, status: 200 })).body as { entries: Record<string, unknown>[] };
    expect(journal.entries).toEqual([expect.objectContaining({
      id: entry.id, title: 'Morning', mood: 4, tags: ['walk'], visibility: 'private', diary_id: defaultDiary,
    })]);
    const used = (await call('GET /api/access-tokens', { as: alice, status: 200 })).body as { tokens: CreatedToken[] };
    expect(used.tokens[0].lastUsedAt).not.toBeNull();
  });

  it('keeps each token to its scopes, and never mixes tokens with sessions', async () => {
    const { alice } = context;
    const writer = await makeToken(alice, ['entries:write']);
    const reader = await makeToken(alice, ['entries:read']);
    await createEntry(context, alice, { text: 'The lighthouse at dawn', date: '2020-05-01' });
    await createEntry(context, alice, { text: 'The lighthouse at dusk', date: '2020-05-02' });

    await call('GET /api/v1/entries', { headers: bearer(writer.token), status: 403, code: 'ACCESS_TOKEN_SCOPE_MISSING' });
    await call('POST /api/v1/entries', { headers: bearer(reader.token), json: { text: 'No' }, status: 403, code: 'ACCESS_TOKEN_SCOPE_MISSING' });
    type Page = { entries: { text: string; date: string; withheld: boolean }[]; nextCursor: string | null };
    const list = async (query: Record<string, string>) =>
      (await call('GET /api/v1/entries', { headers: bearer(reader.token), query: { search: 'lighthouse', limit: '1', ...query }, status: 200 })).body as Page;
    const page = await list({});
    expect(page.entries).toEqual([expect.objectContaining({ text: 'The lighthouse at dusk', date: '2020-05-02', withheld: false })]);
    expect(page.nextCursor).not.toBeNull();
    const next = await list({ after: page.nextCursor! });
    expect(next.entries).toEqual([expect.objectContaining({ text: 'The lighthouse at dawn' })]);
    expect(next.nextCursor).toBeNull();

    await call('POST /api/v1/entries', { headers: bearer(writer.token), json: { text: 'Out loud', visibility: 'public' }, status: 400, code: 'VALIDATION_FAILED' });
    await call('GET /api/v1/diaries', { status: 401, code: 'ACCESS_TOKEN_INVALID' });
    await call('GET /api/v1/diaries', { as: alice, status: 401, code: 'ACCESS_TOKEN_INVALID' });
    await call('GET /api/v1/diaries', { headers: bearer(`${writer.token.slice(0, -1)}x`), status: 401, code: 'ACCESS_TOKEN_INVALID' });
    await call('GET /api/entries', { headers: bearer(writer.token), status: 401, code: 'UNAUTHORIZED' });
    await call('GET /api/access-tokens', { headers: bearer(writer.token), status: 401, code: 'UNAUTHORIZED' });
  });

  it('revokes only the writer’s own tokens, records them in the account activity, and holds ten at most', async () => {
    const { alice, bob } = context;
    const token = await makeToken(bob, ['entries:read']);
    await call('DELETE /api/access-tokens/{id}', { as: alice, params: { id: token.id }, status: 404, code: 'ACCESS_TOKEN_NOT_FOUND' });
    await call('GET /api/v1/diaries', { headers: bearer(token.token), status: 200 });
    await call('DELETE /api/access-tokens/{id}', { as: bob, params: { id: token.id }, status: 200 });
    await call('GET /api/v1/diaries', { headers: bearer(token.token), status: 401, code: 'ACCESS_TOKEN_INVALID' });

    const activity = (await call('GET /api/auth/activity', { as: bob, status: 200 })).body as { events: { kind: string }[] };
    expect(activity.events.slice(0, 2).map(({ kind }) => kind)).toEqual(['access_token_revoked', 'access_token_created']);

    for (let made = 0; made < 10; made += 1) await makeToken(bob, ['entries:read']);
    await call('POST /api/access-tokens', {
      as: bob,
      json: { name: 'One too many', scopes: ['entries:read'], expiresInDays: 30, timeZone: 'UTC' },
      status: 400,
      code: 'ACCESS_TOKEN_LIMIT_REACHED',
    });
    await call('POST /api/access-tokens', {
      as: bob,
      json: { name: 'Bad', scopes: ['account:write'], expiresInDays: 7, timeZone: 'Nowhere/Land' },
      status: 400,
      code: 'VALIDATION_FAILED',
    });
  });

  it('stops every token of an account being deleted', async () => {
    const carol = await registerWriter(context.client, 'carol_access_tokens');
    const token = await makeToken(carol, ['entries:write']);
    await call('GET /api/v1/diaries', { headers: bearer(token.token), status: 200 });

    await call('POST /api/auth/delete-account', { as: carol, json: { password: CONTRACT_PASSWORD }, status: 200 });

    await call('GET /api/v1/diaries', { headers: bearer(token.token), status: 401, code: 'ACCESS_TOKEN_INVALID' });
  });
});
