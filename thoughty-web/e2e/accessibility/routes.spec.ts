import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { setupMockApp } from '../support/mockApp';

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/verify-email?token=valid-token',
  '/about',
  '/privacy',
  '/terms',
  '/contact',
  '/feedback',
  '/blog',
] as const;

const AUTHENTICATED_ROUTES = [
  '/journal',
  '/feed',
  '/tags',
  '/profile',
  '/diaries',
  '/stats',
  '/import-export',
] as const;

const THEMES = ['dark', 'light'] as const;

async function expectNoAccessibilityViolations(page: Page, include?: string) {
  await expect(page.locator('body')).toBeVisible();
  let axe = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
  if (include) axe = axe.include(include);
  const results = await axe.analyze();
  const violations = results.violations.map(({ help, id, impact, nodes }) => ({
    help,
    id,
    impact,
    targets: nodes.map((node) => node.target),
  }));

  expect(violations).toEqual([]);
}

test.describe('route accessibility', () => {
  test.setTimeout(60_000);

  for (const theme of THEMES) {
    for (const path of PUBLIC_ROUTES) {
      test(`${theme} public route ${path}`, async ({ page }) => {
        await setupMockApp(page, { config: { theme } });
        await page.goto(path);

        await expectNoAccessibilityViolations(page);
      });
    }

    for (const path of AUTHENTICATED_ROUTES) {
      test(`${theme} authenticated route ${path}`, async ({ page }) => {
        await setupMockApp(page, { startAuthenticated: true, config: { theme } });
        await page.goto(path);

        await expectNoAccessibilityViolations(page);
      });
    }
  }

  test('public skip links and route changes move focus to page content', async ({ page }) => {
    await setupMockApp(page);
    await page.goto('/');

    await page.keyboard.press('Tab');
    const publicSkipLink = page.getByRole('link', { name: 'Skip to content' });
    await expect(publicSkipLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#public-page-content')).toBeFocused();

    await page.getByRole('button', { name: 'Sign In' }).first().click();
    await expect(page.locator('#public-page-content')).toBeFocused();
  });

  test('authenticated route changes move focus to main content', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');

    await page.getByRole('button', { name: 'Tags', exact: true }).click();
    await expect(page.locator('#main-content')).toBeFocused();
  });

  for (const theme of THEMES) {
    test(`${theme} journal theme review dialog`, async ({ page }) => {
      await setupMockApp(page, {
        startAuthenticated: true,
        config: { theme },
        initialEntries: [{
          id: 300,
          date: '2026-05-03',
          index: 1,
          content: 'I am learning to make steady progress.',
          tags: ['reflection'],
          visibility: 'private',
          diaryId: 1,
        }],
      });
      await page.goto('/tags');
      await page.getByRole('button', { name: 'Organize journal themes' }).click();
      await expect(page.getByRole('dialog', { name: 'Review journal themes' })).toBeVisible();

      await expectNoAccessibilityViolations(page, '.journal-retag-dialog');
    });

    test(`${theme} duplicate review dialog`, async ({ page }) => {
      await setupMockApp(page, {
        startAuthenticated: true,
        config: { theme },
        initialEntries: [{
          id: 301,
          date: '2026-05-02',
          index: 1,
          content: 'I chose to protect mornings for focused work.',
          tags: ['focus'],
          visibility: 'private',
          diaryId: 1,
        }, {
          id: 302,
          date: '2026-05-01',
          index: 1,
          content: 'Keeping mornings free for focus is the right decision.',
          tags: ['focus', 'decision'],
          visibility: 'private',
          diaryId: 1,
        }],
      });
      await page.goto('/journal?diary=1');
      await page.getByRole('button', { name: 'Find duplicates' }).click();
      await expect(page.getByRole('dialog', { name: 'Similar entries' })).toBeVisible();

      await expectNoAccessibilityViolations(page, '.duplicate-review-dialog');
    });

    test(`${theme} semantic search controls`, async ({ page }) => {
      await setupMockApp(page, {
        startAuthenticated: true,
        config: { theme },
        initialEntries: [{
          id: 303,
          date: '2026-05-03',
          index: 1,
          content: 'I made room for a calmer season of work.',
          tags: ['semantic-match'],
          visibility: 'private',
          diaryId: 1,
        }],
      });
      await page.goto('/journal?diary=1');
      await page.getByRole('button', { name: 'Meaning' }).click();
      await page.getByPlaceholder('Search by meaning or idea...').fill('healthier work choices');
      await page.keyboard.press('Enter');
      await expect(page.getByText('Closest matches: 1. Entries analyzed: 1.')).toBeVisible();

      await expectNoAccessibilityViolations(page, '.semantic-search-control');
    });
  }
});
