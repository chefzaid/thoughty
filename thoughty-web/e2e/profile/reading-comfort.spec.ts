import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type Request } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const entries: MockEntry[] = [
  { id: 41, date: '2026-10-20', index: 1, title: 'Lake walk', content: 'Mist on the water, then sun.', tags: [], visibility: 'private', diaryId: 1 },
];

/** The text's computed font family, font size, line height and letter spacing, in pixels where they have them. */
async function typography(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      fontFamily: style.fontFamily,
      fontSize: Number.parseFloat(style.fontSize),
      lineHeight: style.lineHeight === 'normal' ? 'normal' : Number.parseFloat(style.lineHeight),
      letterSpacing: style.letterSpacing === 'normal' ? 'normal' : Number.parseFloat(style.letterSpacing),
    };
  });
}

/** Checks the text is set in the easy-to-read font with loose lines (2.2) and wider letters (0.12em). */
async function expectComfortable(locator: Locator) {
  const { fontFamily, fontSize, lineHeight, letterSpacing } = await typography(locator);
  expect(fontFamily).toMatch(/^"Atkinson Hyperlegible"/);
  expect(lineHeight).toBeCloseTo(fontSize * 2.2, 0);
  expect(letterSpacing).toBeCloseTo(fontSize * 0.12, 1);
}

/** Records the easy-to-read font's files as the page asks for them. */
function fontRequests(page: Page): Request[] {
  const requests: Request[] = [];
  page.on('request', (request) => {
    if (/atkinson-hyperlegible[^/]*\.woff2(\?|$)/.test(request.url())) requests.push(request);
  });
  return requests;
}

/** The font settings this feature adds to (the spacing rows, the font choice and the preview). */
async function axe(page: Page) {
  const rows = ['lineSpacing', 'letterSpacing', 'fontFamily'].map((name) => `.setting-row:has(> select[name="${name}"])`);
  const results = await new AxeBuilder({ page })
    .include([...rows, '.font-preview-card'])
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
}

test.describe('Reading comfort', () => {
  test('picks the easy-to-read font and wider spacing in the profile, previewed live and used wherever entries are read or written', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    const fonts = fontRequests(page);

    await page.goto('/profile');
    const lineSpacing = page.getByRole('combobox', { name: 'Line spacing' });
    const letterSpacing = page.getByRole('combobox', { name: 'Letter spacing' });
    await expect(lineSpacing).toHaveValue('normal');
    await expect(letterSpacing).toHaveValue('normal');
    await expect(lineSpacing).toHaveAccessibleDescription('Room between the lines of your entries');
    expect(await axe(page)).toEqual([]);

    await page.getByRole('combobox', { name: 'Font style' }).selectOption({ label: 'Easy to read (Atkinson Hyperlegible)' });
    await lineSpacing.selectOption({ label: 'Loose' });
    await letterSpacing.selectOption({ label: 'Wider' });
    // The preview shows the choice before it is saved
    await expectComfortable(page.getByTestId('font-preview-sample'));
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect.poll(() => [state.config.fontFamily, state.config.lineSpacing, state.config.letterSpacing]).toEqual(['legible', 'loose', 'wider']);

    // The font comes from the app's own origin, so the CSP's font-src 'self' covers it
    await expect.poll(() => fonts.length).toBeGreaterThan(0);
    const appOrigin = new URL(page.url()).origin;
    for (const request of fonts) {
      expect(new URL(request.url()).origin).toBe(appOrigin);
      expect((await request.response())?.status()).toBe(200);
    }
    expect(await page.evaluate(() => document.fonts.check('16px "Atkinson Hyperlegible"'))).toBe(true);

    // The journal: the composer, an entry as read in the list, and its title only between letters
    await page.goto('/journal');
    await expectComfortable(page.getByPlaceholder("What's on your mind?"));
    const card = page.locator('#entry-41');
    await expectComfortable(card.locator('.privacy-text', { hasText: 'Mist on the water' }));
    const title = await typography(card.getByRole('heading', { name: 'Lake walk' }));
    expect(title.letterSpacing).toBeCloseTo(title.fontSize * 0.12, 1);
    expect(title.lineHeight).toBeLessThan(title.fontSize * 2);

    // Focus mode
    await page.getByRole('button', { name: /Write in focus mode/ }).first().click();
    const focus = page.getByRole('dialog', { name: 'Focus mode' });
    await expectComfortable(focus.getByRole('textbox', { name: 'Entry text' }));
    await focus.getByRole('button', { name: 'Done' }).click();

    // The reader
    await page.locator('.journal-filter-controls').getByRole('button', { name: 'Read like a book' }).click();
    const reader = page.getByRole('dialog', { name: 'Reader' });
    await expect(reader.getByText('Mist on the water, then sun.')).toBeVisible();
    await expectComfortable(reader.locator('.entry-reader-text'));

    // Still there after a reload
    await page.reload();
    await expect(reader.getByText('Mist on the water, then sun.')).toBeVisible();
    await expectComfortable(reader.locator('.entry-reader-text'));
  });

  test('spaces the Markdown editor’s text too, whose own stylesheet fixes its lines', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { lineSpacing: 'loose', letterSpacing: 'wider' } });
    await page.goto('/journal');

    await page.getByTitle('Plain text - click to enable Markdown formatting').click();
    // The editor itself, not the plain textarea shown while it loads
    const field = page.locator('form .w-md-editor').getByPlaceholder("What's on your mind?");
    await expect(field).toBeVisible();
    await field.fill('## A heading\n\nA line long enough to wrap onto the next one, and then another after it.');
    const typed = await typography(field);
    expect(typed.lineHeight).toBeCloseTo(typed.fontSize * 2.2, 0);
    expect(typed.letterSpacing).toBeCloseTo(typed.fontSize * 0.12, 1);
  });

  test('prints with the writer’s spacing and font', async ({ page }) => {
    await page.addInitScript(() => {
      window.print = () => undefined;
    });
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: entries,
      config: { fontFamily: 'legible', lineSpacing: 'loose', letterSpacing: 'wider' },
    });
    await page.goto('/journal');

    await page.locator('#entry-41').getByLabel('More actions').click();
    await page.getByRole('menuitem', { name: 'Print' }).click();
    await page.getByRole('dialog', { name: 'Print this entry' }).getByRole('button', { name: 'Print' }).click();
    await page.emulateMedia({ media: 'print' });
    const sheet = page.locator('.print-sheet');
    await expect(sheet).toContainText('Mist on the water, then sun.');
    await expectComfortable(sheet.locator('.print-entry-text'));
  });

  test('keeps today’s look until the writer changes it, and never downloads the font it does not use', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: entries });
    const fonts = fontRequests(page);

    await page.goto('/journal');
    const text = await typography(page.locator('#entry-41 .privacy-text', { hasText: 'Mist on the water' }));
    expect(text.fontFamily).toMatch(/^system-ui/);
    // The journal's own leading-relaxed, and the font's own letter spacing
    expect(text.lineHeight).toBeCloseTo(text.fontSize * 1.625, 0);
    expect(text.letterSpacing).toBe('normal');

    await page.getByRole('button', { name: /Write in focus mode/ }).first().click();
    const focus = await typography(page.getByRole('dialog', { name: 'Focus mode' }).getByRole('textbox', { name: 'Entry text' }));
    expect(focus.lineHeight).toBeCloseTo(focus.fontSize * 1.7, 0);
    expect(focus.letterSpacing).toBe('normal');
    expect(fonts).toEqual([]);
  });

  test('is named in French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/profile');

    await expect(page.getByRole('combobox', { name: 'Interligne' })).toHaveAccessibleDescription('L’espace entre les lignes de vos notes');
    await expect(page.getByRole('combobox', { name: 'Interligne' }).getByRole('option')).toHaveText(['Normal', 'Aéré', 'Très aéré']);
    await expect(page.getByRole('combobox', { name: 'Espacement des lettres' }).getByRole('option')).toHaveText(['Normal', 'Large', 'Très large']);
    await expect(page.getByRole('option', { name: 'Facile à lire (Atkinson Hyperlegible)' })).toHaveCount(1);
  });
});
