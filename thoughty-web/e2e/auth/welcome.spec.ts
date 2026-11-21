import AxeBuilder from '../support/axe';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';

const composer = (page: Page) => page.getByPlaceholder("What's on your mind?");

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

/** A new account (the welcome page not done yet) that has just signed in. */
async function signInNewAccount(page: Page, config: Record<string, unknown> = {}) {
  const mock = await setupMockApp(page, { startAuthenticated: true, config: { onboardingDone: false, ...config } });
  await page.goto('/login');
  await expect(page).toHaveURL(/\/welcome$/);
  return mock;
}

test.describe('First-run welcome page', () => {
  test('starts a daily journal from the template picked, then lands in the journal on every later sign-in', async ({ page }) => {
    const { state } = await signInNewAccount(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Welcome to Thoughty' })).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await page.getByRole('button', { name: /A daily journal/ }).click();

    await expect(page.getByText('A new entry in Work starts from it while the composer is empty.', { exact: false })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Daily reflection/ })).toBeChecked();
    await expectNoAccessibilityViolations(page);
    await page.getByRole('radio', { name: /Gratitude journal/ }).check();
    await page.getByRole('button', { name: 'Start writing' }).click();

    await expect(page).toHaveURL(/\/journal\?diary=1$/);
    await expect(composer(page)).toHaveValue(/^Today I am grateful for:/);
    await expect(page.getByText("Started from this diary's template, Gratitude journal.")).toBeVisible();
    expect(state.diaries.find((diary) => diary.isDefault)).toEqual(expect.objectContaining({ name: 'Work', defaultTemplateId: 'builtin-gratitude' }));
    expect(state.config.onboardingDone).toBe(true);

    // Done once, it never asks again, and going back does not return to it
    await page.goBack();
    await expect(page).not.toHaveURL(/\/welcome/);
    await page.goto('/login');
    await expect(page).toHaveURL(/\/journal$/);
  });

  test('opens the memoir start page for a life story', async ({ page }) => {
    const { state } = await signInNewAccount(page);

    await page.getByRole('button', { name: /My life story/ }).click();

    await expect(page.getByRole('form', { name: 'Start your memoir' })).toBeVisible();
    await expect(page).toHaveURL(/\/memoir$/);
    expect(state.config.onboardingDone).toBe(true);
    expect(state.diaries.every((diary) => !diary.defaultTemplateId)).toBe(true);
  });

  test('opens the importers for a writer coming from another app', async ({ page }) => {
    await signInNewAccount(page);

    await page.getByRole('button', { name: /Coming from another app/ }).click();

    await expect(page).toHaveURL(/\/import-export\?diary=1&section=import/);
    await expect(page.getByRole('region', { name: 'From another app' })).toBeVisible();
  });

  test('keeps the diary as it is for a blank page, and skipping opens the journal', async ({ page }) => {
    const { state } = await signInNewAccount(page);

    await page.getByRole('button', { name: /A daily journal/ }).click();
    await page.getByRole('radio', { name: /A blank page/ }).check();
    await page.getByRole('button', { name: 'Start writing' }).click();
    await expect(composer(page)).toHaveValue('');
    expect(state.diaries.every((diary) => !diary.defaultTemplateId)).toBe(true);

    state.config.onboardingDone = false;
    await page.goto('/login');
    await page.getByRole('button', { name: 'Skip and open my journal' }).click();
    await expect(page).toHaveURL(/\/journal\?diary=1$/);
    expect(state.config.onboardingDone).toBe(true);
  });

  test('speaks French in the light theme and fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await signInNewAccount(page, { language: 'fr', theme: 'light' });

    await expect(page.getByRole('heading', { level: 1, name: 'Bienvenue sur Thoughty' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expectNoAccessibilityViolations(page);
    await page.getByRole('button', { name: /Un journal quotidien/ }).click();
    await expect(page.getByRole('group', { name: 'Choisissez un premier modèle' })).toBeVisible();
    await expect(page.getByText('Une nouvelle entrée de Work part de ce modèle', { exact: false })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Réflexion du jour/ })).toBeChecked();
    await expect(page.getByRole('radio', { name: /Daily reflection/ })).toHaveCount(0);
    await expectNoAccessibilityViolations(page);
    await page.getByRole('button', { name: 'Retour' }).click();
    await expect(page.getByRole('list', { name: 'Qu’est-ce qui vous amène ?' })).toBeVisible();
  });

  test('starts a French journal from a French template', async ({ page }) => {
    const { state } = await signInNewAccount(page, { language: 'fr' });

    await page.getByRole('button', { name: /Un journal quotidien/ }).click();
    await page.getByRole('radio', { name: /Intentions du matin/ }).check();
    await page.getByRole('button', { name: 'Commencer à écrire' }).click();

    await expect(page).toHaveURL(/\/journal\?diary=1$/);
    await expect(page.getByPlaceholder("Qu'avez-vous à l'esprit ?")).toHaveValue(/^Comment je me sens en commençant la journée :/);
    await expect(page.getByText('Commencé à partir du modèle de ce journal, Intentions du matin.')).toBeVisible();
    expect(state.diaries.find((diary) => diary.isDefault)).toEqual(expect.objectContaining({ defaultTemplateId: 'builtin-morning-intentions' }));
  });
});
