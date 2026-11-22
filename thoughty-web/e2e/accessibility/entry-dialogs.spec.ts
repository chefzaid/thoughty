import AxeBuilder, { expectReadableOnHover } from '../support/axe';
import { expect, test, type Page } from '../support/test';

import { setupMockApp } from '../support/mockApp';
import { mockDiary } from '../support/mockApp.diaries';
import type { MockEntry } from '../support/mockApp.shared';

const ENTRY: MockEntry = { id: 401, date: '2026-10-20', index: 1, title: 'Harbor run', content: 'A morning run by the harbor.', tags: ['running'], visibility: 'private', diaryId: 1 };
const DIARIES = [
  mockDiary({ id: 1, name: 'Personal', icon: '📔', isDefault: true }),
  mockDiary({ id: 2, name: 'Travel', icon: '✈️' }),
];

// Each dialog an entry's More actions opens with a white-on-colour main button.
const DIALOGS = [
  { menuItem: 'Move to diary…', dialog: 'Move to diary', button: 'Move' },
  { menuItem: 'Print', dialog: 'Print this entry', button: 'Print' },
  { menuItem: 'Remind me to reread…', dialog: 'Remind me to reread', button: 'Remind me' },
  { menuItem: 'Share as image', dialog: 'Share as image', button: 'Download PNG' },
  { menuItem: 'Summarize entry', dialog: 'Entry summary', button: 'Generate summary' },
];

async function expectNoAccessibilityViolations(page: Page, dialog: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include('[role="dialog"]')
    .analyze();
  const violations = results.violations.map(({ id, nodes }) => ({
    id,
    // The summary keeps the measured colors and ratio, so a failure says why, not just where.
    nodes: nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
  }));
  expect.soft({ dialog, violations }).toEqual({ dialog, violations: [] });
}

test.describe('entry dialogs accessibility', () => {
  test.setTimeout(60_000);

  for (const theme of ['dark', 'light'] as const) {
    for (const highContrast of [false, true]) {
      const mode = `${theme}${highContrast ? ' high contrast' : ''}`;

      test(`${mode} move, print, reread, share and summary dialogs, with their main button hovered`, async ({ page }) => {
        await setupMockApp(page, { startAuthenticated: true, diaries: DIARIES, initialEntries: [ENTRY], config: { theme, highContrast } });
        await page.goto('/journal?diary=all');
        const card = page.locator(`#entry-${ENTRY.id}`);
        await expect(card).toBeVisible();

        for (const { menuItem, dialog: name, button: label } of DIALOGS) {
          await card.getByRole('button', { name: 'More actions' }).click();
          await card.getByRole('menuitem', { name: menuItem }).click();
          const dialog = page.getByRole('dialog', { name });
          const button = dialog.getByRole('button', { name: label, exact: true });
          await expect(button).toBeEnabled();

          await expectNoAccessibilityViolations(page, name);
          await expectReadableOnHover(page, [button]);

          await page.keyboard.press('Escape');
          await expect(dialog).toHaveCount(0);
        }
      });
    }
  }
});
