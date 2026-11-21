import type { Response } from 'supertest';
import { describeContract, registerWriter, type ContractContext } from './contract-suite';
import { createEntry, PNG_PIXEL, todayIso } from './contract-fixtures';
import type { ContractRequest, ContractUser } from './contract-client';
import type { ApiErrorCode } from '../../src/common/errors/api-error-codes';

/** Words only the locked entries hold: no answer may carry them while the request is not unlocked. */
const SECRET = 'Lighthousekeeper';
const SECRET_TAG = 'hiddenharbor';
const PIN = '2468';

interface Outcome {
  status: number;
  code?: ApiErrorCode;
  contentType?: RegExp;
  binary?: boolean;
}

/** bcrypt, at the cost passwords use, makes every PIN check take a while. */
const PIN_TEST_TIMEOUT_MS = 60_000;

/**
 * One route that reads what locked entries hold, called as the writer without an unlock and then with
 * one: `locked` and `unlocked` are what each answers. Every locked answer must leave the secret words out;
 * an unlocked answer that `reveals` them must carry them.
 */
interface GatedRoute {
  operation: string;
  request: Omit<ContractRequest, 'as' | 'status' | 'code' | 'headers' | 'contentType' | 'binary'>;
  locked: Outcome;
  unlocked: Outcome;
  reveals: boolean;
}

function bodyText(response: Response): string {
  if (Buffer.isBuffer(response.body)) return response.body.toString('utf8');
  return response.text || JSON.stringify(response.body);
}

describeContract('content-lock', (context) => {
  const call: typeof context.client.call = (operation, options) => context.client.call(operation, options);

  const unlock = async (as: ContractUser, pin = PIN): Promise<string> => {
    const response = await call('POST /api/content-lock/unlock', { as, json: { pin }, status: 200 });
    return (response.body as { token: string }).token;
  };

  it('sets, changes and removes the PIN with a proof, and blocks tries after five wrong PINs', async () => {
    const carol = await registerWriter(context.client, 'carol_content_lock');
    const status = async (): Promise<Record<string, unknown>> =>
      (await call('GET /api/content-lock', { as: carol, status: 200 })).body as Record<string, unknown>;
    expect(await status()).toMatchObject({ pinSet: false, hasLockedContent: false, unlocked: false, attemptsLeft: 5, blockedUntil: null });
    await call('POST /api/content-lock/unlock', { as: carol, json: { pin: PIN }, status: 409, code: 'CONTENT_PIN_NOT_SET' });
    await call('POST /api/content-lock/pin/remove', { as: carol, json: {}, status: 409, code: 'CONTENT_PIN_NOT_SET' });

    for (const pin of ['123', '12345', 'abcd']) {
      await call('PUT /api/content-lock/pin', { as: carol, json: { pin }, status: 400, code: 'VALIDATION_FAILED' });
    }
    expect((await call('PUT /api/content-lock/pin', { as: carol, json: { pin: '1357' }, status: 200 })).body).toEqual({ success: true });
    await call('PUT /api/content-lock/pin', { as: carol, json: { pin: PIN }, status: 400, code: 'CONTENT_PIN_PROOF_REQUIRED' });
    await call('PUT /api/content-lock/pin', { as: carol, json: { pin: PIN, password: 'Wrong1234!' }, status: 401, code: 'AUTH_INVALID_PASSWORD' });
    await call('PUT /api/content-lock/pin', { as: carol, json: { pin: PIN, currentPin: '1357' }, status: 200 });

    // Four wrong PINs are only wrong; the fifth blocks tries, and then even the right PIN waits
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await call('POST /api/content-lock/unlock', { as: carol, json: { pin: '0000' }, status: 403, code: 'CONTENT_PIN_INCORRECT' });
    }
    expect(await status()).toMatchObject({ pinSet: true, attemptsLeft: 1, blockedUntil: null });
    await call('POST /api/content-lock/unlock', { as: carol, json: { pin: '0000' }, status: 429, code: 'CONTENT_PIN_BLOCKED' });
    await call('POST /api/content-lock/unlock', { as: carol, json: { pin: PIN }, status: 429, code: 'CONTENT_PIN_BLOCKED' });
    const blocked = await status();
    expect(blocked.attemptsLeft).toBe(0);
    expect(new Date(String(blocked.blockedUntil)).getTime()).toBeGreaterThan(Date.now() + 50_000);
    // The lockout is kept in the database, so a restart does not lift it; the current PIN cannot be used meanwhile
    const [row] = (await context.api.dataSource.query('SELECT failed_attempts FROM content_pins WHERE user_id = $1', [carol.id])) as { failed_attempts: number }[];
    expect(row?.failed_attempts).toBe(5);
    await call('PUT /api/content-lock/pin', { as: carol, json: { pin: '9999', currentPin: PIN }, status: 429, code: 'CONTENT_PIN_BLOCKED' });

    // A forgotten PIN is reset with the account password, which also clears the wrong tries
    await call('PUT /api/content-lock/pin', { as: carol, json: { pin: '9999', password: carol.password }, status: 200 });
    expect(await status()).toMatchObject({ attemptsLeft: 5, blockedUntil: null });
    const token = await unlock(carol, '9999');
    expect((await call('GET /api/content-lock', { as: carol, headers: { 'X-Content-Unlock': token }, status: 200 })).body).toMatchObject({ unlocked: true });

    await call('POST /api/content-lock/pin/remove', { as: carol, json: { currentPin: '1111' }, status: 403, code: 'CONTENT_PIN_INCORRECT' });
    await call('POST /api/content-lock/pin/remove', { as: carol, json: { currentPin: '9999' }, status: 200 });
    // Removing the PIN ends its unlocks
    expect(await status()).toMatchObject({ pinSet: false, unlocked: false });
    expect((await call('GET /api/content-lock', { as: carol, headers: { 'X-Content-Unlock': token }, status: 200 })).body).toMatchObject({ unlocked: false });
  }, PIN_TEST_TIMEOUT_MS);

  it('withholds or refuses every route that reads locked content until unlocked, and locks again at once', async () => {
    const { alice, bob } = await writeLockedJournal(context);
    const lockedIds = { entry: alice.lockedEntry, diaryEntry: alice.vaultEntry };

    const routes: GatedRoute[] = [
      { operation: 'GET /api/entries', request: { query: { limit: '50' } }, locked: { status: 200 }, unlocked: { status: 200 }, reveals: true },
      { operation: 'GET /api/entries', request: { query: { search: SECRET } }, locked: { status: 200 }, unlocked: { status: 200 }, reveals: true },
      { operation: 'GET /api/entries', request: { query: { tags: SECRET_TAG } }, locked: { status: 200 }, unlocked: { status: 200 }, reveals: true },
      { operation: 'GET /api/entries/by-date', request: { query: { id: String(lockedIds.entry) } }, locked: { status: 200 }, unlocked: { status: 200 }, reveals: true },
      { operation: 'GET /api/entries/calendar', request: { query: { month: alice.month } }, locked: { status: 200 }, unlocked: { status: 200 }, reveals: true },
      { operation: 'GET /api/entries/random', request: { query: { search: SECRET } }, locked: { status: 404, code: 'ENTRY_RANDOM_NO_MATCH' }, unlocked: { status: 200 }, reveals: false },
      { operation: 'GET /api/entries/reader', request: { query: { search: SECRET } }, locked: { status: 404, code: 'ENTRY_READER_NO_MATCH' }, unlocked: { status: 200 }, reveals: true },
      { operation: 'GET /api/entries/comfort-reads', request: {}, locked: { status: 200 }, unlocked: { status: 200 }, reveals: true },
      { operation: 'GET /api/entries/open-tasks', request: {}, locked: { status: 200 }, unlocked: { status: 200 }, reveals: true },
      { operation: 'GET /api/entries/highlights', request: { query: { today: todayIso() } }, locked: { status: 200 }, unlocked: { status: 200 }, reveals: true },
      { operation: 'GET /api/entries/tags', request: {}, locked: { status: 200 }, unlocked: { status: 200 }, reveals: true },
      { operation: 'GET /api/entries/{id}/backlinks', request: { params: { id: lockedIds.entry } }, locked: { status: 423, code: 'CONTENT_LOCKED' }, unlocked: { status: 200 }, reveals: false },
      { operation: 'GET /api/entries/{id}/history', request: { params: { id: lockedIds.entry } }, locked: { status: 423, code: 'CONTENT_LOCKED' }, unlocked: { status: 200 }, reveals: true },
      { operation: 'PATCH /api/entries/{id}/tasks', request: { params: { id: lockedIds.diaryEntry }, json: { line: 1, checked: false } }, locked: { status: 423, code: 'CONTENT_LOCKED' }, unlocked: { status: 200 }, reveals: true },
      { operation: 'GET /api/attachments/file/{filename}', request: { params: { filename: alice.photo } }, locked: { status: 423, code: 'CONTENT_LOCKED' }, unlocked: { status: 200, contentType: /^image\/png/, binary: true }, reveals: false },
      { operation: 'GET /api/stats', request: {}, locked: { status: 200 }, unlocked: { status: 200 }, reveals: true },
      { operation: 'GET /api/review', request: { query: { year: alice.month.slice(0, 4) } }, locked: { status: 200 }, unlocked: { status: 200 }, reveals: true },
      { operation: 'GET /api/review/week', request: { query: { today: todayIso() } }, locked: { status: 200 }, unlocked: { status: 200 }, reveals: false },
      { operation: 'GET /api/people', request: {}, locked: { status: 200 }, unlocked: { status: 200 }, reveals: false },
      { operation: 'GET /api/recycle-bin', request: {}, locked: { status: 200 }, unlocked: { status: 200 }, reveals: true },
      { operation: 'GET /api/books/preview', request: { query: { narrative: 'false' } }, locked: { status: 200 }, unlocked: { status: 200 }, reveals: false },
      { operation: 'GET /api/books/picked-entries', request: { query: { entryIds: String(lockedIds.entry) } }, locked: { status: 200 }, unlocked: { status: 200 }, reveals: true },
      { operation: 'GET /api/io/export', request: { query: { format: 'json' } }, locked: { status: 200, contentType: /^application\/json/ }, unlocked: { status: 200, contentType: /^application\/json/ }, reveals: true },
      { operation: 'GET /api/config/download-data', request: {}, locked: { status: 423, code: 'CONTENT_LOCKED' }, unlocked: { status: 200, contentType: /^application\/json/ }, reveals: true },
      { operation: 'POST /api/ai/summarize', request: { json: { entryId: lockedIds.entry } }, locked: { status: 423, code: 'CONTENT_LOCKED' }, unlocked: { status: 400, code: 'AI_KEY_NOT_CONFIGURED' }, reveals: false },
      { operation: 'GET /api/ai/history/{entryId}', request: { params: { entryId: lockedIds.entry } }, locked: { status: 423, code: 'CONTENT_LOCKED' }, unlocked: { status: 200 }, reveals: false },
      { operation: 'PUT /api/entries/{id}', request: { params: { id: lockedIds.entry }, json: alice.lockedEdit }, locked: { status: 423, code: 'CONTENT_LOCKED' }, unlocked: { status: 200 }, reveals: true },
    ];

    const answer = (route: GatedRoute, outcome: Outcome, headers: Record<string, string>) =>
      call(route.operation, { ...route.request, as: alice.user, headers, ...outcome });

    for (const route of routes) {
      const response = await answer(route, route.locked, {});
      expect({ route: route.operation, leaked: bodyText(response).includes(SECRET) || bodyText(response).includes(SECRET_TAG) })
        .toEqual({ route: route.operation, leaked: false });
    }
    // A token that is not one, or another writer's, unlocks nothing
    const bobsToken = await unlock(bob.user, '1357');
    for (const header of ['not-a-token', 'f'.repeat(64), bobsToken]) {
      const listed = await call('GET /api/entries', { as: alice.user, query: { search: SECRET }, headers: { 'X-Content-Unlock': header }, status: 200 });
      expect((listed.body as { total: number }).total).toBe(0);
    }

    const token = await unlock(alice.user);
    for (const route of routes) {
      const response = await answer(route, route.unlocked, { 'X-Content-Unlock': token });
      if (route.reveals) {
        expect({ route: route.operation, revealed: bodyText(response).includes(SECRET) || bodyText(response).includes(SECRET_TAG) })
          .toEqual({ route: route.operation, revealed: true });
      }
    }
    const people = await call('GET /api/people', { as: alice.user, headers: { 'X-Content-Unlock': token }, status: 200 });
    expect((people.body as { people: { name: string; entryCount: number }[] }).people).toEqual([expect.objectContaining({ entryCount: 1 })]);

    // Locking again ends the unlock on the server at once
    await call('DELETE /api/content-lock/unlock', { as: alice.user, headers: { 'X-Content-Unlock': token }, status: 200 });
    const relocked = await call('GET /api/entries', { as: alice.user, query: { search: SECRET }, headers: { 'X-Content-Unlock': token }, status: 200 });
    expect((relocked.body as { total: number }).total).toBe(0);
    // Without a request for 15 minutes the unlock ends too
    const idle = await unlock(alice.user);
    await context.api.dataSource.query("UPDATE content_unlocks SET expires_at = now() - interval '1 second' WHERE user_id = $1", [alice.user.id]);
    expect((await call('GET /api/content-lock', { as: alice.user, headers: { 'X-Content-Unlock': idle }, status: 200 })).body).toMatchObject({ unlocked: false });
  }, PIN_TEST_TIMEOUT_MS);

  it('keeps locked entries and diaries private, their links closed, and the lock on until unlocked', async () => {
    const { alice } = await writeLockedJournal(context, 'dave_content_lock');
    const user = alice.user;
    await call('PATCH /api/entries/{id}/visibility', { as: user, params: { id: alice.lockedEntry }, json: { visibility: 'public' }, status: 409, code: 'CONTENT_LOCKED_PRIVATE' });
    await call('PUT /api/diaries/{id}', { as: user, params: { id: alice.vault }, json: { name: 'Vault', visibility: 'public' }, status: 409, code: 'CONTENT_LOCKED_PRIVATE' });
    await call('POST /api/share-links', { as: user, json: { kind: 'entry', targetId: alice.vaultEntry, expiresAt: inDays(7) }, status: 409, code: 'CONTENT_LOCKED_PRIVATE' });
    await call('DELETE /api/diaries/{id}', { as: user, params: { id: alice.vault }, status: 423, code: 'CONTENT_LOCKED' });
    await call('PATCH /api/entries/{id}/lock', { as: user, params: { id: alice.lockedEntry }, json: { locked: false }, status: 423, code: 'CONTENT_LOCKED' });
    await call('PATCH /api/diaries/{id}/lock', { as: user, params: { id: alice.vault }, json: { locked: false }, status: 423, code: 'CONTENT_LOCKED' });
    await call('PATCH /api/entries/{id}/lock', { as: context.bob, params: { id: alice.lockedEntry }, json: { locked: true }, status: 404, code: 'ENTRY_NOT_FOUND' });
    await call('PATCH /api/diaries/{id}/lock', { as: context.bob, params: { id: alice.vault }, json: { locked: true }, status: 404, code: 'DIARY_NOT_FOUND' });

    // A public entry with a link: locking makes it private and the link stops opening, without being deleted
    const shared = await createEntry(context, user, { text: 'Out in the open', visibility: 'public' });
    const link = await call('POST /api/share-links', { as: user, json: { kind: 'entry', targetId: shared, expiresAt: inDays(7) }, status: 201 });
    const linkToken = (link.body as { token: string }).token;
    const locked = await call('PATCH /api/entries/{id}/lock', { as: user, params: { id: shared }, json: { locked: true }, status: 200 });
    expect((locked.body as { entry: Record<string, unknown> }).entry).toMatchObject({ is_locked: true, withheld: true, visibility: 'private', content: '' });
    await call('GET /api/shared/{token}', { params: { token: linkToken }, status: 404, code: 'SHARE_LINK_NOT_FOUND' });
    // An entry moved into a locked diary is locked and private with it
    const moved = await createEntry(context, user, { text: 'Moving in', visibility: 'public' });
    await call('POST /api/entries/bulk', { as: user, json: { ids: [moved], action: 'move', diaryId: alice.vault }, status: 200 });
    const [movedRow] = (await context.api.dataSource.query('SELECT visibility, diary_locked FROM entries WHERE id = $1', [moved])) as { visibility: string; diary_locked: boolean }[];
    expect(movedRow).toEqual({ visibility: 'private', diary_locked: true });

    const token = await unlock(user);
    const headers = { 'X-Content-Unlock': token };
    const unlockedEntry = await call('PATCH /api/entries/{id}/lock', { as: user, params: { id: shared }, json: { locked: false }, headers, status: 200 });
    expect((unlockedEntry.body as { entry: Record<string, unknown> }).entry).toMatchObject({ is_locked: false, withheld: false, content: 'Out in the open' });
    await call('GET /api/shared/{token}', { params: { token: linkToken }, status: 200 });
    const vault = await call('PATCH /api/diaries/{id}/lock', { as: user, params: { id: alice.vault }, json: { locked: false }, headers, status: 200 });
    expect(vault.body).toMatchObject({ id: alice.vault, isLocked: false });
    const listed = await call('GET /api/entries', { as: user, query: { search: SECRET }, status: 200 });
    // Only the entry locked on its own stays locked once its diary is not
    expect((listed.body as { entries: { id: number }[] }).entries.map((entry) => entry.id)).toEqual([alice.vaultEntry]);
  }, PIN_TEST_TIMEOUT_MS);
});

function inDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

interface LockedJournal {
  user: ContractUser;
  lockedEntry: number;
  vault: number;
  vaultEntry: number;
  photo: string;
  month: string;
  lockedEdit: Record<string, unknown>;
}

/**
 * A writer with a PIN, an entry locked on its own (titled, tagged, favorite, with a photo, a mention and a
 * revision, a year ago today and in the recycle bin as a twin) and a locked diary holding a task list;
 * plus a second writer with a PIN of their own, whose unlock must open nothing of the first's.
 */
async function writeLockedJournal(
  context: ContractContext,
  username = 'alice',
): Promise<{ alice: LockedJournal; bob: { user: ContractUser } }> {
  const call: typeof context.client.call = (operation, options) => context.client.call(operation, options);
  const user = username === 'alice' ? context.alice : await registerWriter(context.client, username);
  const bob = context.bob;
  await call('PUT /api/content-lock/pin', { as: user, json: { pin: PIN }, status: 200 });
  if (username === 'alice') {
    await call('PUT /api/content-lock/pin', { as: bob, json: { pin: '1357' }, status: 200 });
  }

  // On this day a year ago, for Highlights
  const today = todayIso();
  const yearAgo = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  const upload = await call('POST /api/attachments/upload', {
    as: user,
    multipart: { files: [{ field: 'file', buffer: PNG_PIXEL, filename: 'lamp.png', contentType: 'image/png' }] },
    status: 201,
  });
  const photo = upload.body as { id: number; stored_filename: string };
  const lockedEdit = { text: `${SECRET} kept the lamp lit for @Marguerite`, tags: [SECRET_TAG], date: yearAgo, visibility: 'private', format: 'plain', title: 'The keeper' };
  const lockedEntry = await createEntry(context, user, { text: `${SECRET} on the rocks`, title: 'The keeper', tags: [SECRET_TAG, 'gratitude'], date: yearAgo, mood: 2 });
  await call('PUT /api/entries/{id}', { as: user, params: { id: lockedEntry }, json: lockedEdit, status: 200 });
  await call('POST /api/attachments/{id}/link', { as: user, params: { id: photo.id }, json: { entryId: lockedEntry }, status: 200 });
  await call('PATCH /api/entries/{id}/favorite', { as: user, params: { id: lockedEntry }, json: { isFavorite: true }, status: 200 });
  const binned = await createEntry(context, user, { text: `${SECRET} in the bin`, date: yearAgo });

  const vault = (await call('POST /api/diaries', { as: user, json: { name: 'Vault' }, status: 201 })).body as { id: number };
  const vaultEntry = await createEntry(context, user, {
    text: `# Tasks\n- [ ] row ${SECRET} to the island`,
    format: 'markdown',
    diaryId: vault.id,
    date: yearAgo,
  });

  for (const id of [lockedEntry, binned]) {
    const locked = await call('PATCH /api/entries/{id}/lock', { as: user, params: { id }, json: { locked: true }, status: 200 });
    expect((locked.body as { entry: Record<string, unknown> }).entry).toMatchObject({ id, is_locked: true, withheld: true, content: '', tags: [] });
  }
  await call('DELETE /api/entries/{id}', { as: user, params: { id: binned }, status: 200 });
  const diary = await call('PATCH /api/diaries/{id}/lock', { as: user, params: { id: vault.id }, json: { locked: true }, status: 200 });
  expect(diary.body).toMatchObject({ id: vault.id, isLocked: true, visibility: 'private' });

  return {
    alice: { user, lockedEntry, vault: vault.id, vaultEntry, photo: photo.stored_filename, month: yearAgo.slice(0, 7), lockedEdit },
    bob: { user: bob },
  };
}
