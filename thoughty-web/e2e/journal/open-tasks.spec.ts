import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import type { MockEntry } from '../support/mockApp.shared';

const errands: MockEntry = {
  id: 801,
  date: '2026-10-21',
  index: 1,
  title: 'Errands',
  content: ['Saturday errands', '', '- [ ] Call the **bank**', '- [x] Post the letter', '```', '- [ ] Not a task, just code', '```', '  * [ ] Water the plants'].join('\n'),
  tags: ['errands'],
  visibility: 'private',
  format: 'markdown',
  diaryId: 1,
};

const trip: MockEntry = {
  id: 802,
  date: '2026-09-02',
  index: 1,
  content: 'Before the trip\n\n1. [ ] Book the train',
  tags: [],
  visibility: 'private',
  format: 'markdown',
  diaryId: 2,
};

const plain: MockEntry = {
  id: 803,
  date: '2026-10-30',
  index: 1,
  content: '- [ ] Written as plain text, so no task',
  tags: [],
  visibility: 'private',
  diaryId: 1,
};

test.describe('Open tasks', () => {
  test('lists every open task newest first and ticks one off in place, in its entry too', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [errands, trip, plain] });
    await page.goto('/journal?diary=all');

    await page.getByRole('navigation').getByRole('button', { name: 'Tasks' }).click();
    await expect(page).toHaveURL(/\/tasks\?diary=all$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Open tasks' })).toBeVisible();
    await expect(page.getByText('3 open tasks')).toBeVisible();

    const entries = page.getByRole('article');
    await expect(entries).toHaveCount(2);
    await expect(entries.nth(0)).toHaveAccessibleName('October 21, 2026 · Errands');
    await expect(entries.nth(1)).toHaveAccessibleName('September 2, 2026');
    const saturday = entries.nth(0);
    await expect(saturday.getByRole('checkbox')).toHaveCount(2);
    await expect(page.getByText('Not a task, just code')).toHaveCount(0);
    await expect(page.getByText('Post the letter')).toHaveCount(0);

    const bank = saturday.getByRole('checkbox', { name: 'Call the bank' });
    await bank.focus();
    await page.keyboard.press('Space');
    await expect(bank).toBeChecked();
    await expect(bank).toBeFocused();
    await expect(page.getByRole('status').getByText('Ticked off: Call the bank')).toBeVisible();
    await expect(page.getByText('2 open tasks')).toBeVisible();
    await expect.poll(() => state.entries.find((entry) => entry.id === 801)?.content).toContain('- [x] Call the **bank**');
    expect(state.taskRequests).toEqual([{ entryId: 801, line: 2, checked: true, text: 'Call the **bank**' }]);

    // Its entry opens from the list, ticked there too
    await saturday.getByRole('link', { name: 'Open the entry of October 21, 2026' }).click();
    await expect(page).toHaveURL(/\/journal/);
    await expect(page.locator('#entry-801').getByRole('checkbox', { name: 'Call the bank' })).toBeChecked();

    await page.goto('/tasks?diary=all');
    await expect(page.getByRole('checkbox', { name: 'Call the bank' })).toHaveCount(0);
    await expect(page.getByText('2 open tasks')).toBeVisible();
  });

  test('follows the diary, says when one has nothing left to do, and hides the count in quiet mode', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [errands, trip], config: { quietMode: true } });
    await page.goto('/tasks?diary=2');

    await expect(page.getByRole('checkbox', { name: 'Book the train' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Call the bank' })).toHaveCount(0);
    await expect(page.getByText(/open tasks?$/)).toHaveCount(0);

    await page.getByRole('button', { name: /Work/ }).click();
    await expect(page).toHaveURL(/\/tasks\?diary=1$/);
    await expect(page.getByRole('checkbox', { name: 'Call the bank' })).toBeVisible();

    await page.getByRole('checkbox', { name: 'Call the bank' }).click();
    await page.getByRole('checkbox', { name: 'Water the plants' }).click();
    await page.reload();
    await expect(page.getByText('Nothing left to do in this diary. Write “- [ ] something to do” in a Markdown entry and it shows up here.')).toBeVisible();
  });

  test('refuses a task that changed in its entry since the list loaded, in French, and shows the list again', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, initialEntries: [errands], config: { language: 'fr' } });
    await page.goto('/tasks?diary=all');

    await expect(page.getByRole('heading', { level: 1, name: 'Tâches à faire' })).toBeVisible();
    await expect(page.getByText('2 tâches à faire')).toBeVisible();
    // Another device adds a line on top of the entry: the line the list holds is now another one
    state.entries = state.entries.map((entry) => (entry.id === 801 ? { ...entry, content: `- [ ] New first task\n${entry.content}` } : entry));

    await page.getByRole('checkbox', { name: 'Call the bank' }).click();

    await expect(page.getByText('Cette tâche a changé dans son entrée depuis le chargement de la liste. La liste est à jour : vérifiez-la et réessayez.')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'New first task' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Call the bank' })).not.toBeChecked();
    expect(state.entries[0]?.content).toContain('- [ ] Call the **bank**');
  });

  test('skips no task on the next page after ticking some on this one, and keeps that page on reload', async ({ page }) => {
    // 55 tasks, five per entry, newest first: the first page holds Task 1 to Task 50
    const many: MockEntry[] = Array.from({ length: 11 }, (_, entry) => ({
      id: 900 + entry,
      date: `2026-08-${String(30 - entry).padStart(2, '0')}`,
      index: 1,
      content: Array.from({ length: 5 }, (_, task) => `- [ ] Task ${entry * 5 + task + 1}`).join('\n'),
      tags: [],
      visibility: 'private',
      format: 'markdown',
      diaryId: 1,
    }));
    await setupMockApp(page, { startAuthenticated: true, initialEntries: many });
    await page.goto('/tasks?diary=all');

    const pages = page.getByRole('navigation', { name: 'Open task pages' });
    await expect(pages).toContainText('Page 1 of 2');
    for (const name of ['Task 1', 'Task 49', 'Task 50']) {
      const box = page.getByRole('checkbox', { name, exact: true });
      await box.check();
      await expect(box).toBeChecked();
    }
    await expect(page.getByRole('status').getByText('Ticked off: Task 50')).toBeVisible();
    await expect(page.getByText('52 open tasks')).toBeVisible();

    await pages.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(/\/tasks\?diary=all&page=2$/);
    const boxes = page.getByRole('checkbox');
    await expect(boxes).toHaveCount(5);
    await expect(boxes.first()).toHaveAccessibleName('Task 51');
    await expect(boxes.last()).toHaveAccessibleName('Task 55');
    await expect(pages).toContainText('Page 2 of 2');
    await expect(pages.getByRole('button', { name: 'Next' })).toBeDisabled();

    await page.reload();
    await expect(boxes.first()).toHaveAccessibleName('Task 51');
    await expect(boxes).toHaveCount(5);

    // Back on the first page by its offset, the three left over from page 2 show there instead
    await pages.getByRole('button', { name: 'Previous' }).click();
    await expect(page).toHaveURL(/\/tasks\?diary=all$/);
    await expect(boxes).toHaveCount(50);
    await expect(boxes.first()).toHaveAccessibleName('Task 2');
    await expect(boxes.last()).toHaveAccessibleName('Task 53');
  });

  test('says there is nothing to do yet', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [plain] });
    await page.goto('/tasks?diary=all');
    await expect(page.getByText('Nothing left to do. Write “- [ ] something to do” in a Markdown entry and it shows up here.')).toBeVisible();
  });

  test('blurs the tasks with the privacy blur and passes an accessibility scan', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, initialEntries: [errands, trip] });
    await page.goto('/tasks?diary=all');
    const task = page.getByText('Call the bank');
    await expect(task).toBeVisible();
    await page.getByRole('navigation').getByRole('button', { name: 'Blur entry text' }).click();
    await expect.poll(() => task.evaluate((element) => getComputedStyle(element).filter)).toContain('blur');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
  });
});
