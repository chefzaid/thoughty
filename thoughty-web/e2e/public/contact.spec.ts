import { expect, test } from '../support/test';
import { setupMockApp } from '../support/mockApp';

test.describe('Contact and support page', () => {
  test('sends a visitor message and says so, and points ideas to the community board', async ({ page }) => {
    const { state } = await setupMockApp(page);
    await page.goto('/contact');

    const form = page.getByRole('form', { name: 'Send a message' });
    await form.getByRole('textbox', { name: 'Name' }).fill('Camille');
    await form.getByRole('textbox', { name: 'Email' }).fill('camille@example.com');
    const message = form.getByRole('textbox', { name: 'Message' });
    await expect(message).toHaveAccessibleDescription(/10 to 5,000 characters/);
    await message.fill('How do I move my Day One journal here?');
    await form.getByRole('button', { name: 'Send message' }).click();

    await expect(form.getByRole('status')).toHaveText('Thank you, your message was sent. We will reply by email.');
    await expect(message).toHaveValue('');
    expect(state.contact.sent).toEqual([
      { name: 'Camille', email: 'camille@example.com', message: 'How do I move my Day One journal here?', website: '' },
    ]);

    await page.getByRole('button', { name: 'Open the community board' }).click();
    await expect(page).toHaveURL(/\/feedback$/);
    await expect(page.getByRole('heading', { name: 'Offline writing mode' })).toBeVisible();
  });

  test('keeps the message and explains when the server cannot send it', async ({ page }) => {
    const { state } = await setupMockApp(page, { contact: { failWith: 'CONTACT_NOT_CONFIGURED' } });
    await page.goto('/contact');

    const form = page.getByRole('form', { name: 'Send a message' });
    await form.getByRole('textbox', { name: 'Name' }).fill('Camille');
    await form.getByRole('textbox', { name: 'Email' }).fill('camille@example.com');
    await form.getByRole('textbox', { name: 'Message' }).fill('Is anyone reading this inbox?');
    await form.getByRole('button', { name: 'Send message' }).click();

    await expect(form.getByRole('alert')).toHaveText(
      'Messages cannot be sent from this page right now. Share ideas on the community board instead.',
    );
    await expect(form.getByRole('textbox', { name: 'Message' })).toHaveValue('Is anyone reading this inbox?');
    await expect(form.getByRole('button', { name: 'Send message' })).toBeEnabled();
    expect(state.contact.sent).toEqual([]);
  });

  test('lets the browser stop a message too short to send', async ({ page }) => {
    const { state } = await setupMockApp(page);
    await page.goto('/contact');

    const form = page.getByRole('form', { name: 'Send a message' });
    await form.getByRole('textbox', { name: 'Name' }).fill('Camille');
    await form.getByRole('textbox', { name: 'Email' }).fill('camille@example.com');
    const message = form.getByRole('textbox', { name: 'Message' });
    await message.pressSequentially('Hi');
    await form.getByRole('button', { name: 'Send message' }).click();

    expect(await message.evaluate((field: HTMLTextAreaElement) => field.validity.tooShort)).toBe(true);
    await expect(form.getByRole('status')).toBeEmpty();
    await expect(form.getByRole('button', { name: 'Send message' })).toBeEnabled();
    expect(state.contact.sent).toEqual([]);
  });

  test('speaks French, fills in a signed-in writer’s address and fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const { state } = await setupMockApp(page, { startAuthenticated: true, config: { language: 'fr' } });
    await page.goto('/contact');

    const form = page.getByRole('form', { name: 'Envoyer un message' });
    await expect(form.getByRole('textbox', { name: 'E-mail' })).toHaveValue('test@example.com');
    await form.getByRole('textbox', { name: 'Nom' }).fill('Camille');
    await form.getByRole('textbox', { name: 'Message' }).fill('Comment exporter mon journal ?');
    await form.getByRole('button', { name: 'Envoyer le message' }).click();
    await expect(form.getByRole('status')).toHaveText('Merci, votre message a été envoyé. Nous vous répondrons par e-mail.');
    expect(state.contact.sent).toHaveLength(1);

    await expect(page.getByRole('button', { name: 'Ouvrir le tableau de la communauté' })).toBeVisible();
    await expect(page.getByRole('region', { name: "De l'aide est là pour vous" })).toContainText('Royaume-Uni et Irlande');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
