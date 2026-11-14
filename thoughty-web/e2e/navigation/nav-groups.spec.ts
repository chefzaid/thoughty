import AxeBuilder from '../support/axe';
import { expect, test, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { goToView, navGroupButton, NAV_GROUP_OF_PAGE, type NavPage } from '../support/navigation';

const LONG_NAME = 'Alexandrine Montgomery-Dupont';

const PATH_OF_PAGE: Record<NavPage, string> = {
  Journal: '/journal',
  Memoir: '/memoir',
  Tasks: '/tasks',
  Feed: '/feed',
  People: '/people',
  Stats: '/stats',
  'Year in review': '/review',
  'Manage Diaries': '/diaries',
  Tags: '/tags',
  'Import/Export': '/import-export',
  'Recycle bin': '/recycle-bin',
};

const GROUPS = ['Journaling', 'Social', 'Insights', 'Data'] as const;

async function signIn(page: Page, config: { theme?: 'dark' | 'light'; language?: 'en' | 'fr' } = {}) {
  const { state } = await setupMockApp(page, {
    startAuthenticated: true,
    config: { name: LONG_NAME, ...config },
  });
  state.user.emailVerified = true;
  return state;
}

interface Box { readonly name: string; readonly left: number; readonly right: number; readonly top: number; readonly bottom: number }

/** The boxes of the brand, each group button and each control of the user section, and the nav's own. */
async function measureNav(page: Page) {
  return page.locator('nav.nav-menu').evaluate((nav) => {
    const box = (name: string, element: Element) => {
      const rect = element.getBoundingClientRect();
      return { name, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    };
    const brand = nav.querySelector('.nav-brand');
    const groups = [...nav.querySelectorAll('.nav-group-btn')];
    const userControls = [...nav.querySelectorAll('.nav-user-section > *')]
      .filter((element) => element.getBoundingClientRect().width > 0);
    const profileName = nav.querySelector<HTMLElement>('.profile-name');
    return {
      nav: box('nav', nav),
      parts: [
        ...(brand ? [box('brand', brand)] : []),
        ...groups.map((group) => box(group.textContent?.trim() ?? 'group', group)),
        ...userControls.map((control, index) => box(`user-${index}:${control.className}`, control)),
      ],
      navOverflows: nav.scrollWidth > nav.clientWidth,
      pageOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      nameIsCut: profileName ? profileName.scrollWidth > profileName.clientWidth : false,
      nameTitle: profileName?.title ?? null,
    };
  });
}

function intersects(first: Box, second: Box) {
  return first.left < second.right - 0.5 && second.left < first.right - 0.5
    && first.top < second.bottom - 0.5 && second.top < first.bottom - 0.5;
}

function inside(part: Box, container: Box) {
  return part.left >= container.left - 0.5 && part.right <= container.right + 0.5
    && part.top >= container.top - 0.5 && part.bottom <= container.bottom + 0.5;
}

/** Nothing overlaps, everything stays in the nav's box, and neither the nav nor the page scrolls sideways. */
async function expectTidyNav(page: Page, label: string) {
  const layout = await measureNav(page);
  expect(layout.parts.length, label).toBeGreaterThanOrEqual(1 + GROUPS.length + 2);
  const problems: string[] = [];
  layout.parts.forEach((part, index) => {
    if (!inside(part, layout.nav)) problems.push(`${part.name} leaves the nav`);
    for (const other of layout.parts.slice(index + 1)) {
      if (intersects(part, other)) problems.push(`${part.name} overlaps ${other.name}`);
    }
  });
  if (layout.navOverflows) problems.push('the nav scrolls sideways');
  if (layout.pageOverflows) problems.push('the page scrolls sideways');
  expect(problems, label).toEqual([]);
  expect(layout.nameTitle, label).toBe(LONG_NAME);
}

test.describe('Navigation groups', () => {
  test('reaches every page through its group and marks where you are', async ({ page }) => {
    await signIn(page);
    await page.goto('/profile');
    await expect(page.getByRole('navigation').getByRole('button', { name: 'Journaling', exact: true })).toBeVisible();

    for (const [label, group] of Object.entries(NAV_GROUP_OF_PAGE) as [NavPage, string][]) {
      await goToView(page, label);
      await expect(page).toHaveURL(new RegExp(`${PATH_OF_PAGE[label]}(\\?|$)`));
      // Choosing a page closes its group
      await expect(navGroupButton(page, group)).toHaveAttribute('aria-expanded', 'false');

      for (const other of GROUPS) {
        if (other === group) {
          await expect(navGroupButton(page, other), label).toHaveClass(/\bactive\b/);
        } else {
          await expect(navGroupButton(page, other), label).not.toHaveClass(/\bactive\b/);
        }
      }
      await navGroupButton(page, group).click();
      await expect(page.getByRole('navigation').getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(page.getByRole('navigation').locator('[aria-current="page"]')).toHaveCount(1);
      await navGroupButton(page, group).click();
    }
  });

  test('the logo and name take you to the journal, by mouse or keyboard, with a visible focus ring', async ({ page }) => {
    await signIn(page);
    await page.goto('/stats');
    const brand = page.getByRole('navigation').getByRole('button', { name: 'Thoughty, go to journal', exact: true });
    await expect(brand).toContainText('Thoughty');
    await brand.click();
    await expect(page).toHaveURL(/\/journal(\?|$)/);
    await expect(navGroupButton(page, 'Journaling')).toHaveClass(/\bactive\b/);

    await page.goto('/tags');
    await brand.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/journal(\?|$)/);

    // Shift+Tab back from the first group: a keyboard focus, so the ring shows
    await page.goto('/stats');
    await navGroupButton(page, 'Journaling').focus();
    await page.keyboard.press('Shift+Tab');
    await expect(brand).toBeFocused();
    const outline = await brand.evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outline).not.toBe('none');
  });

  test('opens the year in review on the diary being read, as the Stats page does', async ({ page }) => {
    await signIn(page);
    await page.goto('/stats?diary=2');
    await goToView(page, 'Year in review');
    await expect(page).toHaveURL(/\/review\?diary=2$/);
    await expect(page.getByRole('combobox', { name: 'Diaries' })).toHaveValue('2');

    await page.goto('/stats?diary=all');
    await goToView(page, 'Year in review');
    await expect(page).toHaveURL(/\/review$/);
  });

  test('closes on Escape, on a click outside, and when another group opens', async ({ page }) => {
    await signIn(page);
    await page.goto('/journal');
    const social = navGroupButton(page, 'Social');
    const panel = page.locator(`[id="${await social.getAttribute('aria-controls')}"]`);

    await social.click();
    await expect(social).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(social).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toBeHidden();
    await expect(social).toBeFocused();

    await social.click();
    await expect(panel).toBeVisible();
    await page.locator('#main-content').click({ position: { x: 5, y: 5 } });
    await expect(social).toHaveAttribute('aria-expanded', 'false');

    await social.click();
    await navGroupButton(page, 'Data').click();
    await expect(social).toHaveAttribute('aria-expanded', 'false');
    await expect(navGroupButton(page, 'Data')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('works with the keyboard alone', async ({ page }) => {
    await signIn(page);
    await page.goto('/journal');
    await expect(navGroupButton(page, 'Journaling')).toBeVisible();

    // Skip link, the brand, then the first group: the closed groups' pages are out of the tab order
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Thoughty, go to journal' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(navGroupButton(page, 'Journaling')).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(navGroupButton(page, 'Insights')).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(navGroupButton(page, 'Insights')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('navigation').getByRole('button', { name: 'Stats', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('navigation').getByRole('button', { name: 'Year in review', exact: true })).toBeFocused();
    // Tabbing out of the group closes it
    await page.keyboard.press('Tab');
    await expect(navGroupButton(page, 'Data')).toBeFocused();
    await expect(navGroupButton(page, 'Insights')).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.press('Space');
    await expect(navGroupButton(page, 'Data')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('navigation').getByRole('button', { name: 'Tags', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('navigation').getByRole('button', { name: 'Import/Export', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/import-export(\?|$)/);
    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('speaks French', async ({ page }) => {
    await signIn(page, { language: 'fr' });
    await page.goto('/journal');
    for (const group of ['Écriture', 'Social', 'Analyses', 'Données']) {
      await expect(navGroupButton(page, group)).toBeVisible();
    }
    await goToView(page, 'Tags', 'fr');
    await expect(page).toHaveURL(/\/tags(\?|$)/);
    await expect(navGroupButton(page, 'Données')).toHaveClass(/\bactive\b/);
    await page.getByRole('navigation').getByRole('button', { name: 'Thoughty, aller au journal', exact: true }).click();
    await expect(page).toHaveURL(/\/journal(\?|$)/);

    await goToView(page, 'Statistiques', 'fr');
    await expect(page).toHaveURL(/\/stats(\?|$)/);
    await expect(navGroupButton(page, 'Analyses')).toHaveClass(/\bactive\b/);
    await goToView(page, 'Bilan de l’année', 'fr');
    await expect(page).toHaveURL(/\/review(\?|$)/);
    await goToView(page, 'Corbeille', 'fr');
    await expect(page.getByRole('heading', { level: 1, name: 'Corbeille' })).toBeVisible();
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`${theme} theme: no accessibility violations with a group open`, async ({ page }) => {
      await signIn(page, { theme });
      await page.goto('/stats');
      await navGroupButton(page, 'Insights').click();
      await expect(page.getByRole('navigation').getByRole('button', { name: 'Year in review', exact: true })).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .include('nav.nav-menu')
        .analyze();
      expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
    });
  }

  for (const language of ['en', 'fr'] as const) {
    for (const width of [1280, 1440, 1470, 375]) {
      test(`${language} at ${width}px: nothing overlaps or leaves the nav`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await signIn(page, { language });
        await page.goto('/journal');
        await expect(page.locator('.nav-group-btn')).toHaveCount(GROUPS.length);
        await expectTidyNav(page, `${language} ${width}px`);
      });
    }

    test(`${language}: stays tidy at every width from 320 to 2560px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 900 });
      await signIn(page, { language });
      await page.goto('/journal');
      await expect(page.locator('.nav-group-btn')).toHaveCount(GROUPS.length);
      for (let width = 320; width <= 2560; width += 16) {
        await page.setViewportSize({ width, height: 900 });
        await expectTidyNav(page, `${language} ${width}px`);
      }
    });
  }

  test('the profile name ends in an ellipsis when it is too long for the row', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await signIn(page);
    await page.goto('/journal');
    await expect(page.locator('.profile-name')).toHaveText(LONG_NAME);
    const layout = await measureNav(page);
    expect(layout.nameIsCut).toBe(true);
    await expect(page.locator('.profile-name')).toHaveCSS('text-overflow', 'ellipsis');
  });
});
