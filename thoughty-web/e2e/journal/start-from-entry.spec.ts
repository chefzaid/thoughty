import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const picture = { id: 77, original_filename: 'map.png', stored_filename: 'stored-map', mimetype: 'image/png', size: 68 };

const weeklyPlan = {
  id: 801,
  date: '2024-03-04',
  index: 1,
  title: 'Week 10',
  time_of_day: '08:15',
  mood: 4,
  content: 'Weekly plan\n\n- [x] Gym on Monday\n- [ ] Call grandma\n\n![Route to the gym](attachment:77)',
  tags: ['plans', 'weekly'],
  visibility: 'public' as const,
  format: 'markdown' as const,
  diaryId: 1,
  attachments: [picture],
};

const FRESH_PLAN = 'Weekly plan\n\n- [ ] Gym on Monday\n- [ ] Call grandma\n\nRoute to the gym';

test.describe('Start from an entry', () => {
  test('fills the empty form with the text, tags and format, every task unticked, and saves a new private entry', async ({ page }) => {
    // The source entry is public; the draft takes the default visibility, private here
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [weeklyPlan] });
    await page.goto('/journal');

    const card = page.locator('#entry-801');
    await card.getByLabel('More actions').click();
    await page.getByRole('menuitem', { name: 'Use as a starting point' }).click();

    const form = page.locator('form').first();
    const text = form.getByPlaceholder("What's on your mind?");
    await expect(form.getByRole('button', { name: 'Insert one of the attached pictures' })).toBeVisible();
    await expect(text).toHaveValue(FRESH_PLAN);
    await expect(text).toBeFocused();
    await expect(form.getByLabel('Title (optional)')).toHaveValue('');
    await expect(form.getByLabel('Time of day (optional)')).toHaveValue('');
    await expect(form.getByRole('button', { name: 'Remove plans tag' })).toBeVisible();
    await expect(form.getByRole('button', { name: 'Remove weekly tag' })).toBeVisible();
    await expect(form.getByTitle('Private - only you can see')).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    // The source entry is not changed
    expect(state.entries.find((entry) => entry.id === 801)?.content).toBe(weeklyPlan.content);

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => state.entries.find((entry) => entry.id !== 801)).toMatchObject({
      content: FRESH_PLAN,
      tags: ['plans', 'weekly'],
      visibility: 'private',
      format: 'markdown',
      title: null,
      time_of_day: null,
      mood: null,
    });
  });

  test('asks before replacing a draft, keeps it on Cancel and replaces it once confirmed', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [weeklyPlan] });
    await page.goto('/journal');

    const form = page.locator('form').first();
    const text = form.getByPlaceholder("What's on your mind?");
    await text.fill('A thought I do not want to lose');
    await form.getByLabel('Title (optional)').fill('Tuesday');

    const menuButton = page.locator('#entry-801').getByLabel('More actions');
    await menuButton.click();
    await page.getByRole('menuitem', { name: 'Use as a starting point' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Replace your draft?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .include('[role="alertdialog"]')
      .analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(menuButton).toBeFocused();
    await expect(text).toHaveValue('A thought I do not want to lose');
    await expect(form.getByLabel('Title (optional)')).toHaveValue('Tuesday');

    await menuButton.click();
    await page.getByRole('menuitem', { name: 'Use as a starting point' }).click();
    await dialog.getByRole('button', { name: 'Replace draft' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(form.getByPlaceholder("What's on your mind?")).toHaveValue(FRESH_PLAN);
    await expect(form.getByPlaceholder("What's on your mind?")).toBeFocused();
    await expect(form.getByLabel('Title (optional)')).toHaveValue('');
  });

  test('names the action and the warning in French', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [weeklyPlan], config: { language: 'fr' } });
    await page.goto('/journal');

    await page.locator('form').first().locator('textarea').fill('Brouillon');
    await page.locator('#entry-801').getByLabel("Plus d'actions").click();
    await page.getByRole('menuitem', { name: 'Utiliser comme point de départ' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Remplacer votre brouillon ?' });
    await expect(dialog).toContainText('toutes les tâches décochées');
    await expect(dialog.getByRole('button', { name: 'Remplacer le brouillon' })).toBeVisible();
  });
});
