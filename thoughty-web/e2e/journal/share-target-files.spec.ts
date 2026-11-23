import { expect, test, type Page, type Route } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { MOCK_PNG } from '../support/mockApp.routes.attachments';
import { buildMockBookPdf } from '../support/mockBookPdf';
import { cachedRequests, installServiceWorker } from '../support/serviceWorker';

const TODAY = '2026-11-01';
const API = 'http://localhost:5173/api/**';

interface SharedFile {
  readonly name: string;
  readonly mimeType: string;
  readonly buffer: Buffer;
}

const beachPhoto: SharedFile = { name: 'beach.png', mimeType: 'image/png', buffer: MOCK_PNG };
// A PDF the browser can show: the viewer of one it cannot show takes the focus as it loads (see pdf-preview-focus.spec.ts)
const ticket: SharedFile = {
  name: 'ticket.pdf',
  mimeType: 'application/pdf',
  buffer: buildMockBookPdf({ title: 'Ferry ticket', author: 'Harbor Lines', includeToc: false, chapters: [{ title: 'Outbound', paragraphs: ['Departs at 08:15 from pier 3.'] }] }),
};

const composerText = (page: Page) => page.locator('form').first().locator('textarea').first();
const composerForm = (page: Page) => page.locator('form').first();

/**
 * Shares to the installed app as the phone's share sheet does once the manifest's `share_target` is a
 * `POST`: a page load posting a multipart form with the text fields and the files to `/share-target`.
 * Resolves with the address the service worker sends the page on to.
 */
async function shareToApp(page: Page, fields: Record<string, string>, files: readonly SharedFile[]): Promise<URL> {
  await page.evaluate((textFields) => {
    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/share-target';
    form.enctype = 'multipart/form-data';
    form.dataset.shareSheet = '';
    for (const [name, value] of Object.entries(textFields)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.append(input);
    }
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.name = 'files';
    picker.multiple = true;
    form.append(picker);
    document.body.append(form);
  }, fields);
  const sheet = page.locator('form[data-share-sheet]');
  await sheet.locator('input[type="file"]').setInputFiles([...files]);
  const opened = page.waitForRequest((request) => request.isNavigationRequest() && new URL(request.url()).pathname === '/share-target');
  await sheet.evaluate((form: HTMLFormElement) => form.submit());
  return new URL((await opened).url());
}

/** Asks the worker, as the page does, for the files kept under `id`, and gives how many it handed over. */
const filesTheWorkerStillKeeps = (page: Page, id: string) => page.evaluate((filesId) => new Promise<number>((resolve) => {
  const channel = new MessageChannel();
  channel.port1.onmessage = (event: MessageEvent<{ files: File[] }>) => resolve(event.data.files.length);
  navigator.serviceWorker.controller?.postMessage({ type: 'thoughty:take-shared-files', id: filesId }, [channel.port2]);
}), id);

test.describe('Share photos and files to Thoughty', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00`));
  });

  test('attaches a photo and a file shared with text to a private entry for today, keeping nothing in the worker', async ({ page, context }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { defaultVisibility: 'public' } });
    await page.goto('/journal');
    await expect(composerText(page)).toBeVisible();
    await installServiceWorker(page, context);

    const opened = await shareToApp(page, { title: 'Low tide', text: 'Shells everywhere' }, [beachPhoto, ticket]);
    // The worker sends the page on with the text, and only an id for the files it keeps
    expect(opened.searchParams.get('text')).toBe('Shells everywhere');
    const filesId = opened.searchParams.get('files') ?? '';
    expect(filesId).toMatch(/^[0-9a-f-]{36}$/);

    await expect(page).toHaveURL(/\/journal(\?|$)/);
    await expect(composerText(page)).toHaveValue('Shells everywhere');
    await expect(composerForm(page).getByText('beach.png')).toBeVisible();
    await expect(composerForm(page).getByText('ticket.pdf')).toBeVisible();
    await expect(composerText(page)).toBeFocused();

    // Handed over once: the worker gave the files up, and its cache holds the app shell alone
    expect(await filesTheWorkerStillKeeps(page, filesId)).toBe(0);
    expect(await cachedRequests(page)).toEqual(['/index.html']);

    const tagField = composerForm(page).locator('input[placeholder="tags..."]');
    await tagField.fill('beach');
    await tagField.press('Enter');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => state.entries.at(-1)?.attachments?.map((attachment) => attachment.original_filename)).toEqual(['beach.png', 'ticket.pdf']);
    expect(state.entries.at(-1)).toMatchObject({ date: TODAY, title: 'Low tide', content: 'Shells everywhere', visibility: 'private' });

    // Writing on as the entry is saved: the save empties the composer of the entry, not of what came after
    await composerText(page).fill('Evening walk');
    await expect(page.locator('[id^="entry-"]').getByText('Shells everywhere')).toBeVisible();
    await expect(composerText(page)).toHaveValue('Evening walk');
    // A photo shared alone joins the draft being written, without replacing it
    await expect(page.getByText('Draft saved')).toBeVisible();
    await shareToApp(page, {}, [beachPhoto]);
    await expect(composerText(page)).toHaveValue('Evening walk');
    await expect(composerForm(page).getByText('beach.png')).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('keeps the files shared through signing in', async ({ page, context }) => {
    await setupMockApp(page);
    await page.goto('/');
    await installServiceWorker(page, context);

    await shareToApp(page, { text: 'From the gallery' }, [beachPhoto]);
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole('button', { name: 'Sign In' }).first().click();
    await page.locator('#identifier').fill('TestUser');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/journal(\?|$)/);
    await expect(composerText(page)).toHaveValue('From the gallery');
    await expect(composerForm(page).getByText('beach.png')).toBeVisible();
  });

  test('takes a photo shared offline into the composer, saved once Thoughty answers again', async ({ page, context }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');
    await expect(composerText(page)).toBeVisible();
    await installServiceWorker(page, context);

    const cutApi = (route: Route) => route.abort('internetdisconnected');
    await page.route(API, cutApi);
    await page.reload();
    await expect(page.getByTestId('offline-notice')).toBeVisible();

    await shareToApp(page, { text: 'No signal up here' }, [beachPhoto]);
    await expect(composerText(page)).toHaveValue('No signal up here');
    await expect(composerForm(page).getByText('beach.png')).toBeVisible();
    await expect(page.getByTestId('offline-notice')).toBeVisible();

    await page.unroute(API, cutApi);
    await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
    await expect(page.getByTestId('offline-notice')).toHaveCount(0);
    const tagField = composerForm(page).locator('input[placeholder="tags..."]');
    await tagField.fill('hike');
    await tagField.press('Enter');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => state.entries.at(-1)?.attachments?.map((attachment) => attachment.original_filename)).toEqual(['beach.png']);
  });

  test('says so, in French, when what was shared could not be received', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });

    // Where no worker received the post, the web server sends the page here
    await page.goto('/share-target?unreceived=1');
    await expect(page).toHaveURL(/\/journal(\?|$)/);
    await expect(page.getByText('Thoughty n’a pas pu recevoir ce que vous avez partagé. Ouvrez Thoughty une fois, puis partagez-le à nouveau.')).toBeVisible();
    await expect(composerText(page)).toHaveValue('');
  });
});
