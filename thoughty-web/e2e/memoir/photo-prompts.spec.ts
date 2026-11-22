import AxeBuilder from '../support/axe';
import { MOCK_PNG } from '../support/mockApp.routes.attachments';
import { setupMockApp } from '../support/mockApp';
import { expect, test } from '../support/test';

const photo = { name: 'wedding.png', mimeType: 'image/png', buffer: MOCK_PNG };
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.describe('Memoir photo prompts', () => {
  for (const theme of ['dark', 'light'] as const) {
    test(`tells an old photo’s story in a life chapter and reads it in the journal with the photo, in the ${theme} theme`, async ({ page }) => {
      const { state } = await setupMockApp(page, { startAuthenticated: true, config: { theme }, memoirProgram: { diaryId: 2 } });
      await page.goto('/memoir');

      const card = page.getByRole('region', { name: 'Photo prompts' });
      await card.getByRole('button', { name: 'Tell a photo’s story' }).click();
      const form = card.getByRole('form', { name: 'Photo prompts' });
      await expect(form.getByRole('button', { name: 'Choose a photo' })).toBeFocused();

      // A file that is not a picture books print is turned away before any upload
      await form.locator('input[type="file"]').setInputFiles({ name: 'drawing.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
      await expect(form.getByRole('alert')).toHaveText('Choose a JPEG, PNG, GIF or WebP picture.');
      await form.locator('input[type="file"]').setInputFiles(photo);
      await expect(form.getByText('Chosen photo: wedding.png')).toBeVisible();
      await form.getByLabel('Describe the photo (optional)').fill('The church, June 1974');
      await expect(form.getByRole('img', { name: 'The church, June 1974' })).toBeVisible();

      await form.getByRole('button', { name: 'Save the story' }).click();
      await expect(form.getByRole('alert')).toHaveText('Tell what is happening in the photo.');
      await form.getByLabel('What is happening here?').fill('My parents marry in the rain.');
      await form.getByLabel('Life chapter').selectOption({ label: 'Work' });

      const results = await new AxeBuilder({ page }).include('.memoir-photos').withTags(WCAG).analyze();
      expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);

      await form.getByRole('button', { name: 'Save the story' }).click();
      await expect(page.getByText('Photo story saved to your memoir.')).toBeVisible();
      expect(state.memoir.lastPhotoPayload).toEqual({
        attachmentId: expect.any(Number),
        text: 'My parents marry in the rain.',
        caption: 'The church, June 1974',
        chapterId: 'work',
      });
      await expect(card.getByRole('button', { name: 'Tell a photo’s story' })).toBeFocused();
      // Its words count towards the book, the photo's do not
      await expect(page.getByRole('region', { name: 'Your progress' }).getByText('6', { exact: true })).toBeVisible();

      const stories = card.getByRole('list', { name: 'Your photo stories' });
      await expect(stories.getByRole('listitem')).toHaveCount(1);
      await stories.getByRole('button', { name: /^Read in journal: Photo story of / }).click();
      await expect(page).toHaveURL(/\/journal\?entry=\d+/);
      await expect(page.getByText('My parents marry in the rain.')).toBeVisible();
      await expect(page.getByRole('img', { name: 'The church, June 1974' })).toBeVisible();
    });
  }

  test('says in French why a picture already on an entry cannot start a story', async ({ page }) => {
    await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' }, memoirProgram: { diaryId: 2 } });
    await page.route('**/api/memoir/photo-answers', (route) =>
      route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ statusCode: 409, code: 'MEMOIR_PHOTO_IN_USE', message: 'In use' }) }));
    await page.goto('/memoir');

    const card = page.getByRole('region', { name: 'Questions photo' });
    await card.getByRole('button', { name: 'Raconter une photo' }).click();
    await card.locator('input[type="file"]').setInputFiles(photo);
    await card.getByLabel('Que se passe-t-il ici ?').fill('Le mariage de mes parents.');
    await card.getByRole('button', { name: 'Enregistrer le récit' }).click();

    await expect(card.getByRole('alert')).toHaveText('Cette image est déjà sur une entrée. Choisissez de nouveau la photo pour l’envoyer à nouveau.');
    await expect(card.getByLabel('Que se passe-t-il ici ?')).toHaveValue('Le mariage de mes parents.');
  });
});
