import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../support/test';

import { setupMockApp } from '../support/mockApp';
import type { MockEntry, SetupMockAppOptions } from '../support/mockApp.shared';

const nextYear = new Date().getFullYear() + 1;
const sealedLetter: MockEntry = {
  id: 701,
  date: '2026-01-05',
  index: 1,
  title: 'Dear future me',
  content: 'Remember the lighthouse at dusk.',
  tags: ['future-self'],
  visibility: 'private',
  diaryId: 1,
  capsule: { openAt: `${nextYear}-03-01T08:00:00.000Z`, sealedAt: '2026-01-05T10:00:00.000Z', openedAt: null },
};

/** Opens Highlights with a capsule opened two hours ago and returns its section. */
async function openHighlightsWithCapsule(page: Page, config: SetupMockAppOptions['config'] = {}) {
  const openedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  await setupMockApp(page, {
    startAuthenticated: true,
    config,
    initialEntries: [
      { ...sealedLetter, capsule: { openAt: openedAt, sealedAt: '2025-03-01T10:00:00.000Z', openedAt } },
      { id: 703, date: '2024-04-17', index: 1, content: 'Earlier highlight memory', tags: [], visibility: 'private', diaryId: 1 },
    ],
  });
  await page.goto('/journal?diary=all');
  await page.getByRole('button', { name: 'Highlights' }).click();
  return page.locator('.opened-capsules');
}

test.describe('Time capsules', () => {
  test('seals a letter to the future self from its template, keeping it private and hidden', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [] });
    await page.goto('/journal');

    const form = page.locator('form').first();
    await form.getByLabel('Entry template').selectOption({ label: 'Letter to my future self' });
    const seal = form.getByRole('checkbox', { name: 'Seal as a time capsule' });
    await expect(seal).toBeChecked();
    await expect(form.getByLabel('Opens on', { exact: true })).toHaveValue(new RegExp(`^${new Date().getFullYear() + 1}-`));
    await expect(form.getByTitle('A time capsule stays private while it is sealed')).toBeDisabled();
    await form.getByLabel('Opens on', { exact: true }).fill(`${nextYear}-06-01`);
    await form.getByLabel('Opens at', { exact: true }).selectOption('18');
    await page.getByPlaceholder("What's on your mind?").fill('Dear future me, I hope the garden grew.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect.poll(() => state.entries.find((entry) => entry.content.includes('I hope the garden grew'))).toMatchObject({
      visibility: 'private',
      capsule: { openAt: `${nextYear}-06-01T18:00:00.000Z`, openedAt: null },
    });
    const card = page.getByRole('region', { name: 'Sealed time capsule' });
    await expect(card).toContainText('Time capsule');
    await expect(card).toContainText(`Sealed until June 1, ${nextYear}`);
    await expect(page.getByText('I hope the garden grew')).toHaveCount(0);
    await expect(form.getByRole('checkbox', { name: 'Seal as a time capsule' })).not.toBeChecked();
  });

  test('shows a sealed entry as a placeholder that search cannot find, and opens it early after confirming', async ({ page }) => {
    const { state } = await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [sealedLetter, { id: 702, date: '2026-01-04', index: 1, content: 'An open day', tags: ['days'], visibility: 'private', diaryId: 1 }],
    });
    await page.goto('/journal');

    const card = page.locator('#entry-701');
    await expect(card.getByRole('region', { name: 'Sealed time capsule' })).toContainText(`Sealed until March 1, ${nextYear}`);
    await expect(card).not.toContainText('lighthouse');
    await expect(card.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    const results = await new AxeBuilder({ page }).include('#entry-701').analyze();
    expect(results.violations).toEqual([]);

    await card.getByRole('button', { name: 'Open early' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Open this time capsule now?' });
    await expect(dialog).toContainText('no email is sent');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(card.getByRole('region', { name: 'Sealed time capsule' })).toBeVisible();

    await card.getByRole('button', { name: 'Open early' }).click();
    await dialog.getByRole('button', { name: 'Open now' }).click();
    await expect(page.getByText('Time capsule opened')).toBeVisible();
    await expect(card).toContainText('Remember the lighthouse at dusk.');
    await expect(card.getByRole('heading', { name: 'Dear future me' })).toBeVisible();
    expect(state.entries.find((entry) => entry.id === 701)?.capsule?.openedAt).toEqual(expect.any(String));
  });

  test('keeps a sealed entry out of search until it opens', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [sealedLetter] });
    await page.goto('/journal');
    await expect(page.getByRole('region', { name: 'Sealed time capsule' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Search entries' }).fill('lighthouse');
    await expect(page.getByText('No entries found')).toBeVisible();
  });

  test('shows a newly opened capsule first in Highlights, with the day it was sealed', async ({ page }) => {
    const section = await openHighlightsWithCapsule(page);
    await expect(section.getByRole('heading', { name: 'Time capsules opened' })).toBeVisible();
    await expect(section).toContainText('Dear future me');
    await expect(section).toContainText('Sealed on March 1, 2025');
    const sections = await page.locator('.highlight-section h3').allTextContents();
    expect(sections[0]).toContain('Time capsules opened');

    await section.getByRole('button', { name: /2026-01-05/ }).click();
    await expect(page.locator('#entry-701')).toHaveClass(/highlight-entry/);
  });

  for (const theme of ['light', 'dark'] as const) {
    for (const highContrast of [false, true]) {
      test(`frames an opened capsule in 2px indigo in Highlights, ${theme}${highContrast ? ' high contrast' : ''}`, async ({ page }) => {
        const section = await openHighlightsWithCapsule(page, { theme, highContrast });
        const card = section.locator('.highlight-card');
        await expect(card).toContainText('Dear future me');
        await expect(card).toHaveCSS('border-top-width', '2px');
        await expect(card).toHaveCSS('border-left-width', '2px');
        await expect(card).toHaveCSS('border-top-color', 'rgb(99, 102, 241)');
        // Other highlight cards keep their thin theme border.
        await expect(page.locator('.thought-of-day-modal .highlight-card').filter({ hasText: 'Earlier highlight memory' }).first()).toHaveCSS('border-top-width', '1px');

        await card.getByRole('button', { name: /2026-01-05/ }).focus();
        await expect(card.getByRole('button', { name: /2026-01-05/ })).toBeFocused();
        const results = await new AxeBuilder({ page }).include('.thought-of-day-modal').analyze();
        expect(results.violations).toEqual([]);
      });
    }
  }
});
