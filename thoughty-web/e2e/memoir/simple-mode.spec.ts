import AxeBuilder from '../support/axe';
import { expect, test, type Page } from '../support/test';

import { setupMockApp } from '../support/mockApp';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** A microphone and recorder that hand back a short recording, or a microphone the writer refuses. */
async function installFakeMicrophone(page: Page, allowed = true) {
  await page.addInitScript((allow: boolean) => {
    class FakeMediaRecorder {
      static isTypeSupported(type: string) {
        return type === 'audio/webm';
      }

      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;

      start() {
        this.state = 'recording';
      }

      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['voice'], { type: 'audio/webm' }) });
        this.onstop?.();
      }
    }
    const getUserMedia = () => (allow
      ? Promise.resolve({ getTracks: () => [{ stop() {} }] })
      : Promise.reject(new DOMException('Permission denied', 'NotAllowedError')));
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
    Object.defineProperty(globalThis, 'MediaRecorder', { value: FakeMediaRecorder, configurable: true });
  }, allowed);
}

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

test.describe('Simple memoir mode', () => {
  test('is turned on from the Memoir page, then records and saves an answer with one button and no journal around it', async ({ page }) => {
    await installFakeMicrophone(page);
    const { state } = await setupMockApp(page, { startAuthenticated: true, memoirProgram: { diaryId: 1 } });
    await page.goto('/memoir');

    const card = page.getByRole('region', { name: 'Simple mode' });
    await card.getByLabel('Open in simple mode when signing in and from the weekly email').check();
    await expect.poll(() => state.config.memoirSimpleMode).toBe(true);
    await card.getByRole('button', { name: 'Open simple mode' }).click();

    await expect(page).toHaveURL(/\/memoir\/simple$/);
    await expect(page.getByRole('heading', { level: 1, name: 'What did the home you grew up in look, sound, and smell like?' })).toBeVisible();
    await expect(page.getByText('Your memoir · Childhood')).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await expect(page.getByRole('contentinfo')).toHaveCount(0);
    await expectNoViolations(page);

    await page.getByRole('button', { name: 'Record my answer' }).click();
    const stop = page.getByRole('button', { name: 'Stop recording' });
    await expect(stop).toBeFocused();
    await expect(page.getByRole('timer')).toHaveText(/Recording 0:0\d/);
    await stop.click();

    await expect(page.getByLabel('Listen to your answer')).toBeVisible();
    const save = page.getByRole('button', { name: 'Save my answer' });
    await expect(save).toBeFocused();
    await expect(page.getByRole('button', { name: 'Record again' })).toBeVisible();
    await save.click();

    await expect(page.getByRole('heading', { level: 1, name: 'Thank you' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'saved' })).toHaveText('Your answer is saved in your memoir.');
    await expect(page.getByText('Your next question comes on Sunday, October 25.')).toBeVisible();
    expect(state.memoir.lastAnswerPayload).toEqual({ questionId: 'childhood-home', text: '', attachmentIds: [expect.any(Number)] });

    await page.getByRole('link', { name: 'Open the full app' }).click();
    await expect(page).toHaveURL(/\/memoir$/);
    await expect(page.getByRole('navigation').first()).toBeVisible();
  });

  test('is where signing in and the weekly email lead, and offers writing when the microphone is refused', async ({ page }) => {
    await installFakeMicrophone(page, false);
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { memoirSimpleMode: true }, memoirProgram: { diaryId: 1 } });
    await page.goto('/login');
    await expect(page).toHaveURL(/\/memoir\/simple$/);

    await page.goto('/memoir?question=work-path');
    await expect(page).toHaveURL(/\/memoir\/simple\?question=work-path$/);
    await expect(page.getByRole('heading', { level: 1, name: 'How did you come to do the work you did for most of your life?' })).toBeVisible();

    await page.getByRole('button', { name: 'Record my answer' }).click();
    await expect(page.getByText('Recording is not available here. You can write your answer instead.')).toBeVisible();
    const answer = page.getByLabel('Your answer');
    await expect(answer).toBeFocused();
    await answer.fill('Through a summer job at the harbour.');
    await page.getByRole('button', { name: 'Save my answer' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'saved' })).toHaveText('Your answer is saved in your memoir.');
    expect(state.memoir.lastAnswerPayload).toEqual({ questionId: 'work-path', text: 'Through a summer job at the harbour.' });
    // The week's own question is still waiting
    await page.getByRole('button', { name: 'Answer this week’s question' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'What did the home you grew up in look, sound, and smell like?' })).toBeVisible();
  });

  test('reads in French in the light theme and fits a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installFakeMicrophone(page);
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr', theme: 'light' }, memoirProgram: { diaryId: 1 } });
    await page.goto('/memoir/simple');

    await expect(page.getByRole('heading', { level: 1, name: 'À quoi ressemblait la maison de votre enfance ?' })).toBeVisible();
    await expect(page.getByText('Vos mémoires · Enfance')).toBeVisible();
    await page.getByRole('button', { name: 'Enregistrer ma réponse à voix haute' }).click();
    await page.getByRole('button', { name: 'Arrêter l’enregistrement' }).click();
    await expect(page.getByRole('button', { name: 'Garder ma réponse' })).toBeVisible();
    await expectNoViolations(page);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
