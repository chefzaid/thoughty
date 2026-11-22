import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { registerMockAppRoutes } from '../support/mockApp.routes';
import { reachableHeapStrings } from '../support/heap';
import { mockDiary } from '../support/mockApp.diaries';

/** Words only the first writer's account holds, to look for after she signs out. */
const ADA = {
  entry: 'Lighthouse keeper notes, never to be shared',
  diary: 'Coastline diary',
  draft: 'A thought Ada never sent',
  name: 'Ada Lovelace',
};
const BO_ENTRY = 'Harbour walk with the dog';

/** From now on, records any of Ada's words that reach the page's text or a field, at any commit. */
async function watchForAdasWords(page: Page) {
  await page.evaluate((words) => {
    const seen = new Set<string>();
    const look = () => {
      const fields = [...document.querySelectorAll('input, textarea')].map((field) => (field as HTMLInputElement).value);
      const text = [document.body.textContent ?? '', document.title, ...fields].join('\n');
      for (const word of words) if (text.includes(word)) seen.add(word);
    };
    new MutationObserver(look).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
    look();
    (globalThis as unknown as { adasWordsSeen: () => string[] }).adasWordsSeen = () => [...seen];
  }, Object.values(ADA));
}

const adasWordsSeen = (page: Page) =>
  page.evaluate(() => (globalThis as unknown as { adasWordsSeen: () => string[] }).adasWordsSeen());

test.describe('Signing out', () => {
  test('leaves nothing of the writer on the page, and the next writer sees none of it', async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      user: { id: 1, username: 'ada', email: 'ada@example.com' },
      accessToken: 'ada-access-token',
      config: { theme: 'light', name: ADA.name },
      diaries: [mockDiary({ id: 1, name: ADA.diary, isDefault: true })],
      initialEntries: [{ id: 1, date: '2024-03-04', index: 1, content: ADA.entry, tags: ['private'], visibility: 'private', diaryId: 1 }],
    });
    const sentWith: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) sentWith.push(request.headers().authorization ?? '');
    });

    await page.goto('/journal');
    await expect(page.getByText(ADA.entry)).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/light-mode/);
    await page.getByPlaceholder("What's on your mind?").fill(ADA.draft);

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/$/);
    const afterSignOut = sentWith.length;

    // The presentation page and Sign In are signed out, in the signed-out look
    await expect(page.locator('body')).toHaveClass(/dark-mode/);
    await expect(page.locator('body')).not.toHaveClass(/light-mode/);
    await page.getByRole('button', { name: 'Sign In' }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('.auth-page')).toHaveClass(/\bdark\b/);
    await expect(page.locator('body')).not.toHaveClass(/light-mode/);
    const pageText = await page.evaluate(() => `${document.title}\n${document.body.textContent ?? ''}`);
    for (const word of Object.values(ADA)) expect(pageText, word).not.toContain(word);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('thoughty.composerDraft')))).toEqual([]);
    // Nothing read or typed for Ada is left in memory (the query cache among it), nor asked with her token since
    const held = await reachableHeapStrings(page);
    for (const word of Object.values(ADA)) expect(held.filter((text) => text.includes(word)), word).toEqual([]);
    expect(sentWith.slice(afterSignOut).filter((header) => header !== '')).toEqual([]);

    // Bo signs in on the same browser: another account behind the same mock API
    await setupMockApp(page, {
      user: { id: 2, username: 'bo', email: 'bo@example.com' },
      accessToken: 'bo-access-token',
      initialEntries: [{ id: 7, date: '2024-05-06', index: 1, content: BO_ENTRY, tags: [], visibility: 'private' }],
    });
    await watchForAdasWords(page);
    await page.locator('#identifier').fill('bo');
    await page.locator('#password').fill('password123');
    const signedInAt = sentWith.length;
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/journal/);
    await expect(page.getByText(BO_ENTRY)).toBeVisible();
    await expect(page.getByPlaceholder("What's on your mind?")).toHaveValue('');
    await expect(page.locator('body')).toHaveClass(/dark-mode/);
    expect(await adasWordsSeen(page)).toEqual([]);
    expect(sentWith.slice(signedInAt).filter((header) => header !== '' && header !== 'Bearer bo-access-token')).toEqual([]);
  });

  test('signs this browser’s other tabs out too', async ({ context, page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [{ id: 1, date: '2024-03-04', index: 1, content: ADA.entry, tags: [], visibility: 'private' }],
    });
    const other = await context.newPage();
    await registerMockAppRoutes(other, state);
    await page.goto('/journal');
    await other.goto('/journal');
    await expect(other.getByText(ADA.entry)).toBeVisible();

    await page.getByRole('button', { name: 'Logout' }).click();

    await expect(other).toHaveURL(/\/$/);
    await expect(other.getByText(ADA.entry)).toHaveCount(0);
    await expect(other.getByRole('button', { name: 'Logout' })).toHaveCount(0);
  });
});
