import AxeBuilder from '../support/axe';
import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { mockDiary } from '../support/mockApp.diaries';

const TODAY = '2026-11-01';

/** The address the service worker opens with what the phone's share sheet posted to the installed app. */
const shareAddress = (values: Record<string, string>) => `/share-target?${new URLSearchParams(values).toString()}`;

const composerText = (page: Page) => page.locator('form').first().locator('textarea').first();
const composerTitle = (page: Page) => page.locator('form').first().locator('input[maxlength="200"]');

test.describe('Share to Thoughty', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(`${TODAY}T12:00:00`));
  });

  test('turns a link shared from another app into a private entry for today, in place of the diary template', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      config: { defaultVisibility: 'public' },
      diaries: [mockDiary({ id: 1, name: 'Personal', isDefault: true, defaultTemplateId: 'builtin-gratitude' })],
    });

    // The installed app offers itself in the share sheet, for a title, some text, a link and files, which
    // the service worker receives and sends on to the address below (share-target-files.spec.ts)
    const manifest = await (await page.request.get('/site.webmanifest')).json() as Record<string, unknown>;
    expect(manifest.share_target).toMatchObject({
      action: '/share-target',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: { title: 'title', text: 'text', url: 'url', files: [{ name: 'files' }] },
    });

    await page.goto(shareAddress({ title: 'Tide tables', text: 'High tide at 6, worth the walk', url: 'https://example.org/tides' }));
    await expect(page).toHaveURL(/\/journal(\?|$)/);
    const text = composerText(page);
    await expect(text).toHaveValue('High tide at 6, worth the walk\nhttps://example.org/tides');
    await expect(text).toBeFocused();
    await expect(composerTitle(page)).toHaveValue('Tide tables');
    await expect(page.getByText("Started from this diary's template", { exact: false })).toHaveCount(0);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).include('form').analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);

    // Nothing is filled in but what was shared: tags are the writer's to pick
    const tagField = page.locator('form').first().locator('input[placeholder="tags..."]');
    await tagField.fill('walks');
    await tagField.press('Enter');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => state.entries.at(-1)).toMatchObject({
      date: TODAY,
      title: 'Tide tables',
      content: 'High tide at 6, worth the walk\nhttps://example.org/tides',
      visibility: 'private',
      format: 'plain',
      tags: ['walks'],
    });

    // Shared once: a reload does not fill the composer with it again
    await page.reload();
    await expect(page.locator(`#entry-${state.entries.at(-1)?.id}`)).toBeVisible();
    await expect(composerText(page)).not.toHaveValue(/High tide/);
  });

  test('keeps what was shared through signing in', async ({ page }) => {
    await setupMockApp(page);

    await page.goto(shareAddress({ text: 'A quote worth keeping https://example.org/quote', url: 'https://example.org/quote' }));
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole('button', { name: 'Sign In' }).first().click();
    await page.locator('#identifier').fill('TestUser');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/journal(\?|$)/);
    await expect(composerText(page)).toHaveValue('A quote worth keeping https://example.org/quote');
  });

  test('asks before replacing a draft, in French, and keeps the draft on Cancel', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/journal');
    await composerText(page).fill('Mon brouillon');
    // Saved before leaving, so the draft comes back as it was rather than as one to choose from
    await expect(page.getByText('Brouillon enregistré')).toBeVisible();

    await page.goto(shareAddress({ text: 'Un lien partagé' }));
    const dialog = page.getByRole('alertdialog', { name: 'Remplacer votre brouillon ?' });
    await expect(dialog).toHaveAccessibleDescription(/Ce que vous avez partagé avec Thoughty remplace son texte/);
    await dialog.getByRole('button', { name: 'Annuler' }).click();
    await expect(composerText(page)).toHaveValue('Mon brouillon');

    await page.goto(shareAddress({ text: 'Un autre lien partagé' }));
    await page.getByRole('alertdialog', { name: 'Remplacer votre brouillon ?' }).getByRole('button', { name: 'Remplacer le brouillon' }).click();
    await expect(composerText(page)).toHaveValue('Un autre lien partagé');
  });
});
