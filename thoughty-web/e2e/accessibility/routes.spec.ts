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
  '/tags',
  '/profile',
  '/diaries',
  '/stats',
  '/import-export',
] as const;

const THEMES = ['dark', 'light'] as const;

async function expectNoAccessibilityViolations(page: Page) {
  await expect(page.locator('body')).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
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
});
